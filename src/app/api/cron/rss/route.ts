import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { RSS_SOURCES } from "@/lib/rss/sources";
import { fetchRssSource, type FetchedArticle } from "@/lib/rss/fetcher";
import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";

const PASS_THROUGH_SOURCES = ["Korean FE Article"];

/**
 * GET /api/cron/rss?days=1
 * SSE 스트리밍으로 수집 진행 상황을 실시간 전달
 */
export async function GET(request: NextRequest) {
  const days = Math.min(Math.max(Number(request.nextUrl.searchParams.get("days") ?? 1), 1), 90);
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).getTime();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const settingsDoc = await adminDb.collection("settings").doc("global").get();
        const keywords: string[] = (settingsDoc.data()?.article_keywords as string[]) ?? [];
        const keywordPatterns = keywords.map((k) => k.toLowerCase());

        let totalAdded = 0;
        const pendingAiReview: { article: FetchedArticle; source: string }[] = [];

        for (const source of RSS_SOURCES) {
          send({ type: "source", source: source.name });
          const articles = await fetchRssSource(source);
          let sourceAdded = 0;

          for (const article of articles) {
            if (!article.url) continue;
            if (new Date(article.published_at).getTime() < cutoff) continue;

            const existing = await adminDb
              .collection("articles")
              .where("url", "==", article.url)
              .limit(1)
              .get();
            if (!existing.empty) continue;

            if (PASS_THROUGH_SOURCES.includes(source.name)) {
              await saveArticle(article);
              sourceAdded++;
              continue;
            }

            const text = `${article.title} ${article.summary}`.toLowerCase();
            if (keywordPatterns.some((kw) => text.includes(kw))) {
              await saveArticle(article);
              sourceAdded++;
              continue;
            }

            pendingAiReview.push({ article, source: source.name });
          }

          totalAdded += sourceAdded;
          send({ type: "progress", source: source.name, added: sourceAdded, totalAdded });
        }

        // AI 판단
        if (pendingAiReview.length > 0) {
          send({ type: "ai", count: pendingAiReview.length });
          const aiResult = await filterByAi(
            pendingAiReview.map((p) => p.article),
            keywords,
          );

          for (const idx of aiResult.approved) {
            const item = pendingAiReview[idx];
            if (!item) continue;
            await saveArticle(item.article);
            totalAdded++;
          }

          if (aiResult.newKeywords.length > 0) {
            const existingLower = new Set(keywords.map((k) => k.toLowerCase()));
            const unique = aiResult.newKeywords.filter((k) => !existingLower.has(k.toLowerCase()));
            if (unique.length > 0) {
              await adminDb
                .collection("settings")
                .doc("global")
                .update({
                  article_keywords: [...keywords, ...unique],
                });
            }
          }

          send({ type: "ai_done", aiAdded: aiResult.approved.length, totalAdded });
        }

        send({ type: "done", totalAdded });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function saveArticle(article: FetchedArticle) {
  await adminDb.collection("articles").add({
    ...article,
    is_read: false,
    is_bookmarked: false,
    topic_generated: false,
    created_at: new Date().toISOString(),
  });
}

interface AiFilterResult {
  approved: number[];
  newKeywords: string[];
}

async function filterByAi(
  articles: FetchedArticle[],
  existingKeywords: string[],
): Promise<AiFilterResult> {
  if (articles.length === 0) return { approved: [], newKeywords: [] };

  const list = articles.map((a, i) => `${i}. [${a.title}] ${a.summary.slice(0, 150)}`).join("\n");

  const prompt = `다음 아티클 목록에서 시니어 웹 프론트엔드 개발자에게 유용한 것만 골라줘.
프론트엔드 개발, 웹 기술, JavaScript/TypeScript, React/Next.js, CSS, 성능 최적화, 테스팅, 빌드 도구, AI 활용 등과 관련된 것만 선택해.
일반 뉴스, 하드웨어, 보안(프론트엔드 무관), 채용 공고 등은 제외해.

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 포함하지 마.
- approved: 유용한 아티클 번호 배열 (없으면 빈 배열)
- keywords: 승인된 아티클에서 추출한 프론트엔드 관련 키워드 배열 (기존 키워드와 중복되지 않는 것만)

기존 키워드: ${existingKeywords.join(", ")}

\`\`\`json
{ "approved": [0, 2, 5], "keywords": ["Zustand", "Suspense"] }
\`\`\`

${list}`;

  try {
    const proc = spawnClaude({ agentName: "default", prompt, timeoutMs: 30_000 });
    let fullText = "";
    for await (const event of parseStreamOutput(proc, 30_000)) {
      if (event.type === "text" && event.content) fullText += event.content;
    }

    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { approved: [], newKeywords: [] };

    const parsed = JSON.parse(jsonMatch[0]) as { approved?: number[]; keywords?: string[] };
    return {
      approved: (parsed.approved ?? []).filter(
        (n) => typeof n === "number" && n >= 0 && n < articles.length,
      ),
      newKeywords: (parsed.keywords ?? []).filter((k) => typeof k === "string" && k.trim()),
    };
  } catch (err) {
    console.error("AI filter error:", err);
    return { approved: [], newKeywords: [] };
  }
}
