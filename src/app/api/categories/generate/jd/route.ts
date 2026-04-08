import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";
import { filterSimilarCategories } from "@/lib/categories/similarity";
import { createSSEStream } from "@/lib/categories/sse";

/**
 * POST /api/categories/generate/jd (SSE)
 * JD 인사이트 + 스킬 트렌드를 기반으로 학습 카테고리를 생성한다.
 */
export async function POST(request: NextRequest) {
  const { send, close, response } = createSSEStream();

  (async () => {
    try {
      const body = await request.json();
      const count = Math.min(Math.max(Number(body.count) || 5, 1), 20);

      // 최신 JD 인사이트 조회
      send({ type: "log", message: "JD 인사이트 조회 중..." });
      const { data: insightData } = await supabase
        .from("jd_insights")
        .select("*")
        .order("collected_date", { ascending: false })
        .limit(1)
        .single();

      // 최신 스킬 트렌드 조회
      send({ type: "log", message: "스킬 트렌드 조회 중..." });
      const { data: skillData } = await supabase
        .from("jd_skill_trends")
        .select("skill_name, mention_count")
        .order("collected_date", { ascending: false })
        .limit(20);

      if (!insightData && (!skillData || skillData.length === 0)) {
        send({ type: "error", message: "JD 데이터가 없습니다. 먼저 원티드 JD를 수집해주세요." });
        close();
        return;
      }

      const topSkills = (skillData ?? []).map((s) => `${s.skill_name} (${s.mention_count}건)`);
      send({
        type: "log",
        message: `스킬 ${topSkills.length}개, 인사이트 ${insightData ? "있음" : "없음"}`,
      });

      // 기존 카테고리
      send({ type: "log", message: "기존 카테고리 조회 중..." });
      const { data: existingData } = await supabase
        .from("categories")
        .select("name")
        .order("created_at", { ascending: false })
        .limit(100);
      const existingNames = (existingData ?? []).map((d) => d.name as string);
      send({ type: "log", message: `기존 카테고리 ${existingNames.length}개 확인` });

      // AI 카테고리 생성
      send({ type: "log", message: `AI에게 카테고리 ${count}개 생성 요청 중...` });
      const prompt = buildJdCategoryPrompt(count, existingNames, insightData, topSkills);
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
          source_type: "jd",
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

function buildJdCategoryPrompt(
  count: number,
  existingNames: string[],
  insight: Record<string, unknown> | null,
  topSkills: string[],
): string {
  const recentNames = existingNames.slice(0, 50).join("\n- ");

  // 인사이트 데이터 정리
  let insightSection = "";
  if (insight) {
    const sections: string[] = [];

    const competencies = insight.competencies as Array<{ name: string; count: number }> | null;
    if (competencies?.length) {
      sections.push(
        `### 역량/소프트스킬 (시장에서 요구하는 역량)\n${competencies
          .slice(0, 10)
          .map((c) => `- ${c.name} (${c.count}건)`)
          .join("\n")}`,
      );
    }

    const responsibilities = insight.responsibilities as Array<{
      name: string;
      count: number;
      description: string;
    }> | null;
    if (responsibilities?.length) {
      sections.push(
        `### 주요 업무 패턴\n${responsibilities
          .slice(0, 10)
          .map((r) => `- ${r.name} (${r.count}건): ${r.description}`)
          .join("\n")}`,
      );
    }

    const qualifications = insight.qualifications as Array<{
      name: string;
      count: number;
      description: string;
    }> | null;
    if (qualifications?.length) {
      sections.push(
        `### 자격요건 패턴 (기술 외)\n${qualifications
          .slice(0, 10)
          .map((q) => `- ${q.name} (${q.count}건): ${q.description}`)
          .join("\n")}`,
      );
    }

    const preferred = insight.preferred as Array<{
      name: string;
      count: number;
      description: string;
    }> | null;
    if (preferred?.length) {
      sections.push(
        `### 우대사항 패턴\n${preferred
          .slice(0, 10)
          .map((p) => `- ${p.name} (${p.count}건): ${p.description}`)
          .join("\n")}`,
      );
    }

    const culture = insight.culture as Array<{
      name: string;
      count: number;
      description: string;
    }> | null;
    if (culture?.length) {
      sections.push(
        `### 팀/조직 문화\n${culture
          .slice(0, 10)
          .map((c) => `- ${c.name} (${c.count}건): ${c.description}`)
          .join("\n")}`,
      );
    }

    const summary = insight.summary as string | null;
    if (summary) {
      sections.push(`### 종합 인사이트\n${summary}`);
    }

    insightSection = sections.join("\n\n");
  }

  return `당신은 10년차 시니어 프론트엔드 개발자의 학습 코치입니다.
아래는 원티드에서 수집한 프론트엔드 시니어(5년+) 채용공고를 AI가 분석한 결과입니다.
이 **실제 채용 시장 데이터**를 기반으로 학습 카테고리 ${count}개를 생성해주세요.

## 채용 시장 데이터

### Top 기술 스킬 (언급 빈도순)
${topSkills.length > 0 ? topSkills.join("\n") : "데이터 없음"}

${insightSection}

## 카테고리 생성 규칙

1. **채용 시장 데이터 기반**: 위 데이터에서 드러나는 실제 시장 수요를 반영하세요.
   - 기술 스킬만이 아니라, 역량/업무패턴/문화 등 다양한 영역에서 카테고리를 만드세요.
   - 예: "기술적 의사결정과 커뮤니케이션", "대규모 서비스 성능 최적화", "프론트엔드 아키텍처 설계" 등
2. **학습 가능한 영역**: 하나의 카테고리에서 3~5개의 미션(개념 설명, 기술 토론, 코드 챌린지)이 나올 수 있어야 합니다.
3. **적절한 범위**: "React"처럼 너무 넓거나, 특정 API 하나처럼 너무 좁지 않게.
4. **시니어 수준**: 10년차 개발자가 깊이 있게 학습할 만한 수준이어야 합니다.

## 기존 카테고리 (중복 방지)
- ${recentNames || "없음"}

## 출력 형식
반드시 아래 JSON 배열만 출력하세요. 다른 텍스트는 포함하지 마세요.
\`\`\`json
[
  {
    "name": "카테고리 이름",
    "description": "이 카테고리에서 다루는 학습 범위를 1-2문장으로 설명. 어떤 JD 데이터에서 이 카테고리가 도출되었는지 간단히 언급."
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
