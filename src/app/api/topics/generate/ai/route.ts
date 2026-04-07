import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";

/**
 * POST /api/topics/generate/ai
 * AI가 시니어 프론트엔드 개발자에게 적합한 학습 토픽을 자율 생성한다.
 * body: { count: number } (1~20, 기본 5)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const count = Math.min(Math.max(Number(body.count) || 5, 1), 20);

    // 기존 토픽 제목 조회 (중복 방지)
    const existingSnap = await adminDb
      .collection("topics")
      .orderBy("created_at", "desc")
      .limit(100)
      .get();
    const existingTitles = existingSnap.docs.map((d) => d.data().title as string);

    const prompt = buildAiTopicPrompt(count, existingTitles);

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

    const topics = parseTopicsFromResponse(fullText);
    if (topics.length === 0) {
      return NextResponse.json(
        { error: "AI 응답에서 토픽을 파싱할 수 없습니다." },
        { status: 500 },
      );
    }

    const now = new Date().toISOString();
    let created = 0;

    for (const topic of topics.slice(0, count)) {
      await adminDb.collection("topics").add({
        title: topic.title,
        description: topic.description ?? null,
        mission_type: topic.mission_type,
        category_name: topic.category_name,
        source_type: "ai",
        source_ref: null,
        code_snippet: topic.code_snippet ?? null,
        is_used: false,
        created_at: now,
      });
      created++;
    }

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate ai topics error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function buildAiTopicPrompt(count: number, existingTitles: string[]): string {
  const recentTitles = existingTitles.slice(0, 50).join("\n- ");

  return `당신은 10년차 시니어 프론트엔드 개발자의 학습 코치입니다.
시니어 프론트엔드 개발자가 깊이 있게 학습하고 논의할 수 있는 토픽 ${count}개를 생성해주세요.

## 토픽 요구사항

### mission_type별 특성
- **concept**: 핵심 개념을 깊이 이해하고 설명할 수 있는 주제. 면접에서 "이것을 설명해보세요"라고 물을 수 있는 수준.
  - 예: "JavaScript 이벤트 루프의 마이크로태스크와 매크로태스크 처리 순서", "React Fiber 아키텍처의 동작 원리"
- **discussion**: 기술적 의사결정, 트레이드오프, 아키텍처 논의 주제. 정답이 없고 경험과 판단력이 필요한 주제.
  - 예: "대규모 프론트엔드 팀에서 모노레포 vs 폴리레포 전략", "서버 컴포넌트 도입 시 기존 클라이언트 상태관리의 미래"
- **code**: 실제 코드를 작성하거나 리뷰/리팩토링하는 실전 문제. 구체적인 시나리오가 포함되어야 함.
  - 예: "React concurrent mode에서 race condition을 방지하는 커스텀 훅 구현", "대량 데이터 테이블의 가상 스크롤 최적화"

### 품질 기준
- 시니어 개발자 수준의 깊이 (입문자용 X)
- 최신 기술 트렌드 반영 (React 19, Next.js App Router, TypeScript 5+, Vite, Bun 등)
- concept/discussion/code를 적절히 배분 (편중되지 않게)
- 실무에서 실제로 마주하는 문제와 연결

### 카테고리 예시
React, Next.js, TypeScript, JavaScript, CSS, 성능 최적화, 테스팅, 번들러, 상태관리, 웹 보안, 접근성, DevOps/CI, 디자인 시스템, 브라우저, Node.js 등

## 기존 토픽 (중복 방지)
- ${recentTitles || "없음"}

## 출력 형식
반드시 아래 JSON 배열만 출력하세요. 다른 텍스트는 포함하지 마세요.
\`\`\`json
[
  {
    "title": "토픽 제목",
    "description": "2-3문장의 상세 설명. 무엇을 학습/논의/구현하는지 구체적으로.",
    "mission_type": "concept | discussion | code",
    "category_name": "카테고리명",
    "code_snippet": "code 타입일 경우 리뷰/수정할 코드. 아니면 null"
  }
]
\`\`\``;
}

function parseTopicsFromResponse(text: string): Array<{
  title: string;
  description: string;
  mission_type: "concept" | "discussion" | "code";
  category_name: string;
  code_snippet?: string;
}> {
  // JSON 블록 추출
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (t: Record<string, unknown>) =>
        t.title &&
        t.mission_type &&
        t.category_name &&
        ["concept", "discussion", "code"].includes(t.mission_type as string),
    );
  } catch {
    return [];
  }
}
