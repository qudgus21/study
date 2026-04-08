import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";
import { filterSimilarCategories } from "@/lib/categories/similarity";
import { createSSEStream } from "@/lib/categories/sse";

/** 기술 블로그 소스만 대상 */
const TECH_BLOG_SOURCES = [
  "Korean FE Article",
  "카카오 기술블로그",
  "토스 기술블로그",
  "우아한형제들 기술블로그",
];

/**
 * POST /api/categories/generate/article (SSE)
 * 기술 블로그 아티클에서 AI로 학습 카테고리를 추출한다.
 */
export async function POST(request: NextRequest) {
  const { send, close, response } = createSSEStream();

  (async () => {
    try {
      const body = await request.json();
      const count = Math.min(Math.max(Number(body.count) || 5, 1), 20);

      send({ type: "log", message: "기술 블로그 아티클 조회 중..." });
      const { data: articlesData } = await supabase
        .from("articles")
        .select("*")
        .eq("topic_generated", false)
        .in("source", TECH_BLOG_SOURCES)
        .order("published_at", { ascending: false })
        .limit(count * 3);

      if (!articlesData || articlesData.length === 0) {
        send({ type: "log", message: "변환할 기술 블로그 아티클이 없습니다." });
        send({ type: "done", created: 0 });
        close();
        return;
      }

      send({ type: "log", message: `기술 블로그 아티클 ${articlesData.length}건 발견` });

      // 기존 카테고리
      send({ type: "log", message: "기존 카테고리 조회 중..." });
      const { data: existingData } = await supabase.from("categories").select("name");
      const existingNames = (existingData ?? []).map((d) => d.name as string);
      send({ type: "log", message: `기존 카테고리 ${existingNames.length}개 확인` });

      // AI로 아티클에서 학습 카테고리 추출
      send({ type: "log", message: "AI에게 카테고리 추출 요청 중..." });
      const articleList = articlesData
        .map((a, i) => `${i}. [${a.source}] ${a.title}\n   ${(a.summary as string).slice(0, 200)}`)
        .join("\n");

      const prompt = buildPrompt(count, existingNames, articleList);
      const proc = spawnClaude({ agentName: "default", prompt, timeoutMs: 180_000 });

      let fullText = "";
      for await (const event of parseStreamOutput(proc, 180_000)) {
        if (event.type === "text" && event.content) fullText += event.content;
        if (event.type === "error") {
          send({ type: "error", message: event.message });
          close();
          return;
        }
      }

      const categories = parseCategoriesFromResponse(fullText);
      if (categories.length === 0) {
        send({ type: "error", message: "AI 응답에서 카테고리를 파싱할 수 없습니다." });
        close();
        return;
      }

      send({ type: "log", message: `AI가 ${categories.length}개 후보 생성` });
      for (const cat of categories.slice(0, count)) {
        send({ type: "candidate", name: cat.name });
      }

      // 유사도 검증
      const candidateNames = categories.slice(0, count).map((c) => c.name);
      const duplicates = await filterSimilarCategories(candidateNames, existingNames, (msg) =>
        send({ type: "log", message: msg }),
      );

      // 저장
      const now = new Date().toISOString();
      let created = 0;

      for (const cat of categories.slice(0, count)) {
        if (duplicates.has(cat.name.toLowerCase())) {
          send({ type: "log", message: `"${cat.name}" 유사 카테고리 존재 → 스킵` });
          continue;
        }

        await supabase.from("categories").insert({
          name: cat.name,
          description: cat.description ?? null,
          source_type: "article",
          source_ref: cat.sourceArticle ?? null,
          created_at: now,
        });

        existingNames.push(cat.name);
        created++;
        send({ type: "saved", name: cat.name });
      }

      // 사용된 아티클 topic_generated 마킹
      const articleIds = articlesData.map((a) => a.id as string);
      await supabase.from("articles").update({ topic_generated: true }).in("id", articleIds);

      send({ type: "done", created });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      send({ type: "error", message });
    } finally {
      close();
    }
  })();

  return response;
}

function buildPrompt(count: number, existingNames: string[], articleList: string): string {
  const recentNames = existingNames.slice(0, 50).join("\n- ");

  return `당신은 10년차 시니어 프론트엔드 개발자의 학습 코치입니다.
아래 기술 블로그 아티클 목록을 분석해서, 시니어 프론트엔드 개발자가 깊이 있게 학습할 수 있는 **학습 카테고리** ${count}개를 추출해주세요.

## 카테고리란?
카테고리는 구체적인 질문이 아니라, **학습 영역**을 의미합니다.
하나의 카테고리 아래에 여러 개의 구체적인 미션(개념 설명, 기술 토론, 코드 챌린지)이 생성됩니다.

## 좋은 카테고리 예시
- "브라우저 렌더링 파이프라인" — 개념/코드 미션이 많이 나올 수 있는 영역
- "프론트엔드 모니터링 전략" — 토론/개념 미션이 나올 수 있는 영역
- "React 동시성 모델" — 개념/코드 미션이 많이 나올 수 있는 영역
- "대규모 상태 관리 설계" — 토론/코드 미션이 나올 수 있는 영역

## 나쁜 카테고리 예시 (이렇게 하지 마세요)
- "React" — 너무 넓음
- "JavaScript 이벤트 루프의 마이크로태스크와 매크로태스크 처리 순서" — 이건 미션이지 카테고리가 아님
- 아티클 제목을 그대로 카테고리명으로 사용 — 학습 영역으로 일반화해야 함

## 규칙
- 아티클의 구체적 내용에서 시니어 FE 개발자에게 의미 있는 학습 영역을 추출
- 프론트엔드와 관련 없는 내용(인프라, 백엔드 전용, 채용 등)은 건너뛸 것
- 하나의 카테고리에서 최소 3~5개의 서로 다른 미션이 나올 수 있을 정도의 범위

## 기존 카테고리 (중복 방지)
- ${recentNames || "없음"}

## 아티클 목록
${articleList}

## 출력 형식
반드시 아래 JSON 배열만 출력하세요. 다른 텍스트는 포함하지 마세요.
\`\`\`json
[
  {
    "name": "카테고리 이름",
    "description": "이 카테고리에서 다루는 학습 범위를 1-2문장으로 설명.",
    "sourceArticle": "참고한 아티클 제목"
  }
]
\`\`\``;
}

function parseCategoriesFromResponse(
  text: string,
): Array<{ name: string; description: string; sourceArticle?: string }> {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((c: Record<string, unknown>) => c.name);
  } catch {
    return [];
  }
}
