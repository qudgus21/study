import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";
import { filterSimilarCategories } from "@/lib/categories/similarity";
import { createSSEStream } from "@/lib/categories/sse";

/**
 * POST /api/categories/generate/ai (SSE)
 * AI가 시니어 프론트엔드 개발자에게 적합한 학습 카테고리를 자율 생성한다.
 */
export async function POST(request: NextRequest) {
  const { send, close, response } = createSSEStream();

  (async () => {
    try {
      const body = await request.json();
      const count = Math.min(Math.max(Number(body.count) || 5, 1), 20);

      send({ type: "log", message: "기존 카테고리 조회 중..." });
      const { data: existingData } = await supabase
        .from("categories")
        .select("name")
        .order("created_at", { ascending: false })
        .limit(100);
      const existingNames = (existingData ?? []).map((d) => d.name as string);
      send({ type: "log", message: `기존 카테고리 ${existingNames.length}개 확인` });

      send({ type: "log", message: `AI에게 카테고리 ${count}개 생성 요청 중...` });
      const prompt = buildCategoryPrompt(count, existingNames);
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
        if (duplicates.has(cat.name.toLowerCase())) continue;

        await supabase.from("categories").insert({
          name: cat.name,
          description: cat.description ?? null,
          source_type: "ai",
          source_ref: null,
          created_at: now,
        });
        existingNames.push(cat.name);
        created++;
        send({ type: "saved", name: cat.name });
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

function buildCategoryPrompt(count: number, existingNames: string[]): string {
  const recentNames = existingNames.slice(0, 50).join("\n- ");

  return `당신은 10년차 시니어 프론트엔드 개발자의 학습 코치입니다.
시니어 프론트엔드 개발자가 깊이 있게 학습할 수 있는 **학습 카테고리** ${count}개를 생성해주세요.

## 카테고리란?
카테고리는 구체적인 질문이 아니라, **학습 영역**을 의미합니다.
하나의 카테고리 아래에 여러 개의 구체적인 미션(개념 설명, 기술 토론, 코드 챌린지)이 생성됩니다.

## 좋은 카테고리 예시
- "브라우저 렌더링 파이프라인" — 개념/코드 미션이 많이 나올 수 있는 영역
- "프론트엔드 모니터링 전략" — 토론/개념 미션이 나올 수 있는 영역
- "React 동시성 모델" — 개념/코드 미션이 많이 나올 수 있는 영역
- "마이크로 프론트엔드 아키텍처" — 토론/개념 미션이 많이 나올 수 있는 영역
- "프론트엔드 테스트 전략" — 코드/토론 미션이 고르게 나올 수 있는 영역
- "웹 성능 최적화" — 코드/개념 미션이 많이 나올 수 있는 영역
- "기술 의사결정과 커뮤니케이션" — 토론 미션이 주로 나올 영역

## 나쁜 카테고리 예시 (이렇게 하지 마세요)
- "React" — 너무 넓음
- "JavaScript 이벤트 루프의 마이크로태스크와 매크로태스크 처리 순서" — 이건 미션이지 카테고리가 아님
- "프론트엔드" — 너무 포괄적
- "CSS" — 너무 넓고 모호

## 품질 기준
- 시니어 개발자 수준의 깊이가 나올 수 있는 영역
- 하나의 카테고리에서 최소 3~5개의 서로 다른 미션이 나올 수 있을 정도의 범위
- 너무 넓지도(React), 너무 좁지도(특정 API 하나) 않은 적절한 범위
- 최신 기술 트렌드 반영
- 실무에서 실제로 중요한 영역

## 기존 카테고리 (중복 방지)
- ${recentNames || "없음"}

## 출력 형식
반드시 아래 JSON 배열만 출력하세요. 다른 텍스트는 포함하지 마세요.
\`\`\`json
[
  {
    "name": "카테고리 이름",
    "description": "이 카테고리에서 다루는 학습 범위를 1-2문장으로 설명."
  }
]
\`\`\``;
}

function parseCategoriesFromResponse(text: string): Array<{ name: string; description: string }> {
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
