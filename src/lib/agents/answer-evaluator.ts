import type { Agent, AgentPrompt, AgentPromptInput } from "./types";

const answerEvaluator: Agent = {
  type: "answer-evaluator",
  name: "답변 평가자",
  description: "통일된 채점 포맷으로 모든 미션의 답변을 평가합니다.",

  generatePrompt(input: AgentPromptInput): AgentPrompt {
    const typeLabel =
      input.missionType === "concept"
        ? "개념 설명"
        : input.missionType === "discussion"
          ? "기술 토론"
          : "코드 챌린지";

    const conceptRubric = `1. 기술 정확성 (25점): 핵심 개념이 정확한가?
2. 이해 깊이 (25점): "왜", "어떻게"를 설명하는가?
3. 실무 경험 (20점): 실제 프로젝트 사례가 드러나는가?
4. 트레이드오프 인식 (15점): 장단점, 대안 비교가 있는가?
5. 커뮤니케이션 (15점): 결론부터, 구조적으로 전달하는가?`;

    const discussionRubric = `1. 근거 기반 논증 (25점): 주장을 증거로 뒷받침하는가?
2. 반론 수용 (25점): 반대 관점을 인식하고 대응하는가?
3. 의사결정 프레임워크 (20점): 체계적 판단 기준이 있는가?
4. 경험/데이터 참조 (15점): 실제 경험이나 수치를 참조하는가?
5. 설득력 (15점): 비개발자도 이해할 수 있는 수준인가?`;

    const codeRubric = `1. 이슈 식별 (25점): 코드의 모든 문제를 찾았는가?
2. 근본 원인 분석 (25점): 왜 문제인지 메커니즘 수준에서 설명하는가?
3. 수정안 품질 (20점): 복붙 가능한 수준으로 구체적인가?
4. 성능 측정 (15점): 수정 효과를 어떻게 검증하는가?
5. 엣지케이스 (15점): 수정이 다른 문제를 만들지 않는가?`;

    const rubric =
      input.missionType === "concept"
        ? conceptRubric
        : input.missionType === "discussion"
          ? discussionRubric
          : codeRubric;

    const systemPrompt = `You are an impartial Answer Evaluator for a senior frontend developer study system.
You are evaluating a **senior frontend developer (10+ years experience)**.

미션 타입: ${typeLabel}
카테고리: ${input.categoryName}

## 평가 기준 (0-100점)
${rubric}

## 채점 규칙
- 각 항목 점수는 배점 상한을 초과할 수 없다
- 총점 = 5개 항목 점수의 단순 합산. 임의 보정/조정 금지
- 중간 계산 과정이나 점수 수정 이력을 출력하지 않는다. 최종 점수만 한 번 출력한다

## 점수 캘리브레이션
- 90-100: 전문가/리더급. 해당 주제를 가르칠 수 있는 수준.
- 80-89: 시니어. 탄탄한 이해. 사소한 부분만 부족.
- 65-79: 미들. 기본은 맞지만 깊이, 경험, 프레임워크 부족.
- 40-64: 주니어. 표면적 이해만.
- 0-39: 미달. 부정확하거나 답변 없음.

통과 점수: 80/100. 관대하지 말 것.

IMPORTANT: 반드시 한국어로 응답하세요.`;

    const userPrompt = `## 질문
${input.question}

## 답변 (시도 #${input.attemptNumber})
${input.userAnswer}

${input.previousFeedback ? `## 이전 피드백\n${input.previousFeedback}\n` : ""}

반드시 아래 형식으로 응답해주세요:

**Score: [N]/100**
**Verdict: [PASS/RETRY]**

### 항목별 점수
[미션 타입에 해당하는 5개 항목과 점수를 나열]

### 강점
- [구체적 강점 1 — 답변에서 직접 인용]
- [구체적 강점 2]

### 개선점
- [구체적 개선 제안 1 — 부족한 점 + 보강 방향]
- [구체적 개선 제안 2]

### 핵심 약점 (RETRY인 경우)
- **[항목명] ([N]/[배점])**: [부족한 이유] → [보강 방향 힌트]

### 추천 학습 키워드 (RETRY인 경우)
- [공부할 개념이나 키워드 1-3개]`;

    return {
      systemPrompt,
      userPrompt,
      fullClipboardText: `${systemPrompt}\n\n---\n\n${userPrompt}`,
    };
  },
};

export default answerEvaluator;
