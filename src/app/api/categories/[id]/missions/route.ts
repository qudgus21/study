import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/categories/[id]/missions
 * 카테고리에 속한 미션 목록
 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const { data: missionsData, error } = await supabase
      .from("missions")
      .select("*, attempts(score, created_at)")
      .eq("category_id", id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const missions = (missionsData ?? []).map((doc) => {
      const attempts = (doc.attempts ?? []) as Array<{ score: number | null; created_at: string }>;
      const sorted = [...attempts].sort((a, b) =>
        (a.created_at ?? "").localeCompare(b.created_at ?? ""),
      );

      return {
        ...doc,
        attempts: undefined,
        attempt_count: attempts.length,
        last_score: sorted.length > 0 ? (sorted[sorted.length - 1].score ?? null) : null,
      };
    });

    return NextResponse.json({ missions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/categories/[id]/missions
 * AI로 카테고리에 맞는 미션을 생성한다.
 * body: { count: number } (1~10, 기본 3)
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const count = Math.min(Math.max(Number(body.count) || 3, 1), 10);

    // 카테고리 조회
    const { data: category, error: catError } = await supabase
      .from("categories")
      .select("*")
      .eq("id", id)
      .single();

    if (catError || !category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const categoryName = category.name as string;
    const categoryDescription = (category.description as string) ?? "";

    // 기존 미션 제목 조회 (중복 방지)
    const { data: existingData } = await supabase
      .from("missions")
      .select("title")
      .eq("category_id", id);

    const existingTitles = (existingData ?? []).map((d) => d.title as string);

    const prompt = buildMissionPrompt(categoryName, categoryDescription, count, existingTitles);

    const proc = spawnClaude({
      agentName: "default",
      prompt,
      timeoutMs: 180_000,
    });

    let fullText = "";
    for await (const event of parseStreamOutput(proc, 180_000)) {
      if (event.type === "text" && event.content) {
        fullText += event.content;
      }
      if (event.type === "error") {
        return NextResponse.json({ error: event.message }, { status: 500 });
      }
    }

    const missions = parseMissionsFromResponse(fullText);
    if (missions.length === 0) {
      return NextResponse.json(
        { error: "AI 응답에서 미션을 파싱할 수 없습니다." },
        { status: 500 },
      );
    }

    const now = new Date().toISOString();
    const toInsert = missions.slice(0, count).map((mission) => ({
      category_id: id,
      category_name: categoryName,
      mission_type: mission.mission_type,
      title: mission.title,
      description: mission.description ?? null,
      code_snippet: mission.code_snippet ?? null,
      status: "pending",
      created_at: now,
      completed_at: null,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("missions")
      .insert(toInsert)
      .select("id, title, mission_type");

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, created: inserted?.length ?? 0, missions: inserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate missions error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildMissionPrompt(
  categoryName: string,
  categoryDescription: string,
  count: number,
  existingTitles: string[],
): string {
  const existing = existingTitles.length > 0 ? existingTitles.join("\n- ") : "없음";

  return `당신은 10년차 시니어 프론트엔드 개발자의 학습 코치입니다.
"${categoryName}" 카테고리에서 시니어 개발자가 도전할 미션 ${count}개를 생성하세요.

## 카테고리 정보
- 이름: ${categoryName}
- 설명: ${categoryDescription || "없음"}

## 미션 타입

### concept (개념 설명)
- 시니어 면접관의 "이것을 설명해보세요" 형식
- 단순 정의 X. "왜", "어떻게", "트레이드오프" 수준의 깊이 요구
- 좋은 예: "React Fiber Architecture가 해결하는 문제와 reconciliation 과정을 설명하세요"
- 좋은 예: "V8 엔진의 히든 클래스와 인라인 캐싱이 JavaScript 성능에 미치는 영향을 설명하세요"
- 나쁜 예: "React란 무엇인가요?" (너무 기초)
- 나쁜 예: "useState를 설명하세요" (너무 단순)

### discussion (기술 토론)
- 정답이 없는 의사결정, 비교, 논쟁, 전략 주제
- 경험과 판단력이 드러나야 하는 주제
- 좋은 예: "GraphQL vs REST API: 프론트엔드 개발자 관점에서 선택 기준"
- 좋은 예: "디자인 시스템 구축 vs 오픈소스 UI 라이브러리 사용: 어떻게 결정하겠습니까?"
- 좋은 예: "프론트엔드에서 보안 취약점을 예방하는 개발 문화"
- 나쁜 예: "React와 Vue 중 뭐가 좋나요?" (너무 넓고 모호)

### code (코드 챌린지)
- 실무 시나리오 기반의 구체적 코딩/리뷰/리팩토링 과제
- description에 문제 상황을 구체적으로 설명
- code_snippet에는 리팩토링 대상이나 문제가 있는 코드를 포함 (선택)
- 좋은 예: "웹 워커(Web Worker)로 메인 스레드 블로킹 해결"
- 좋은 예: "대량 데이터 테이블에서 가상 스크롤 직접 구현하기"

## 타입 배분 규칙
카테고리의 성격에 맞게 자율적으로 배분하세요:
- 기술 구현 중심 카테고리 (예: React 동시성, CSS 레이아웃): code를 많이
- 설계/아키텍처 중심 (예: 상태관리 전략, 디자인 시스템): discussion을 많이
- 소프트스킬/문화 (예: 기술 의사결정, 코드리뷰 문화): discussion 중심, code 없어도 됨
- 인프라/DevOps (예: CI/CD, 모니터링): 고르게 배분

## 품질 기준 (중요!)
- 시니어 개발자 수준의 깊이 (주니어/입문자용 질문 금지)
- "~란 무엇인가?" 수준의 단순한 정의 질문 절대 금지
- "~의 트레이드오프", "~ vs ~", "~를 설계할 때 고려사항" 수준이어야 함
- 제목은 구체적이고 날카롭게 — 모호한 "~에 대해 알아보기" 금지
- 실무에서 실제로 마주하는 문제와 연결되어야 함
- 각 미션은 독립적으로 풀 수 있어야 함

## 기존 미션 (중복 방지)
- ${existing}

## 출력 형식
반드시 아래 JSON 배열만 출력하세요. 다른 텍스트는 포함하지 마세요.
\`\`\`json
[
  {
    "title": "구체적이고 날카로운 미션 제목",
    "description": "2-3문장. 이 미션에서 무엇을 답변/구현해야 하는지, 어떤 깊이를 기대하는지 구체적으로 설명.",
    "mission_type": "concept | discussion | code",
    "code_snippet": "code 타입인 경우에만. 리뷰/리팩토링할 실제 코드. 다른 타입이면 null"
  }
]
\`\`\``;
}

function parseMissionsFromResponse(text: string): Array<{
  title: string;
  description: string;
  mission_type: "concept" | "discussion" | "code";
  code_snippet?: string;
}> {
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (m: Record<string, unknown>) =>
        m.title &&
        m.mission_type &&
        ["concept", "discussion", "code"].includes(m.mission_type as string),
    );
  } catch {
    return [];
  }
}
