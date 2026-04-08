import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { filterSimilarCategories } from "@/lib/categories/similarity";
import { createSSEStream } from "@/lib/categories/sse";

/**
 * POST /api/categories/generate/article (SSE)
 * 아직 카테고리로 변환되지 않은 최신 아티클에서 카테고리를 생성한다.
 */
export async function POST(request: NextRequest) {
  const { send, close, response } = createSSEStream();

  (async () => {
    try {
      const body = await request.json();
      const count = Math.min(Math.max(Number(body.count) || 5, 1), 20);

      send({ type: "log", message: "변환 대상 아티클 조회 중..." });
      const { data: articlesData } = await supabase
        .from("articles")
        .select("*")
        .eq("topic_generated", false)
        .order("published_at", { ascending: false })
        .limit(count * 2);

      if (!articlesData || articlesData.length === 0) {
        send({ type: "log", message: "변환할 아티클이 없습니다." });
        send({ type: "done", created: 0 });
        close();
        return;
      }

      send({ type: "log", message: `아티클 ${articlesData.length}건 발견` });

      // 기존 카테고리
      send({ type: "log", message: "기존 카테고리 조회 중..." });
      const { data: existingData } = await supabase.from("categories").select("name");
      const existingNames = (existingData ?? []).map((d) => d.name as string);
      send({ type: "log", message: `기존 카테고리 ${existingNames.length}개 확인` });

      // 후보 수집
      const candidateNames = articlesData.map((d) => (d.source as string) || "기타");
      const uniqueCandidates = [...new Set(candidateNames)];
      send({ type: "log", message: `후보 카테고리 ${uniqueCandidates.length}개 추출` });
      for (const name of uniqueCandidates) {
        send({ type: "candidate", name });
      }

      // 유사도 검증
      const duplicates = await filterSimilarCategories(uniqueCandidates, existingNames, (msg) =>
        send({ type: "log", message: msg }),
      );

      // 저장
      const now = new Date().toISOString();
      let created = 0;

      for (const articleRow of articlesData) {
        if (created >= count) break;

        const categoryName = (articleRow.source as string) || "기타";

        if (duplicates.has(categoryName.toLowerCase())) {
          await supabase.from("articles").update({ topic_generated: true }).eq("id", articleRow.id);
          send({ type: "log", message: `"${categoryName}" 유사 카테고리 존재 → 스킵` });
          continue;
        }

        const { data: newCat } = await supabase
          .from("categories")
          .insert({
            name: categoryName,
            description: `${articleRow.title} 등 아티클에서 추출된 학습 영역`,
            source_type: "article",
            source_ref: articleRow.url as string,
            created_at: now,
          })
          .select("id")
          .single();

        await supabase
          .from("articles")
          .update({
            topic_generated: true,
            topic_id: newCat?.id ?? null,
          })
          .eq("id", articleRow.id);

        existingNames.push(categoryName);
        created++;
        send({ type: "saved", name: categoryName });
      }

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
