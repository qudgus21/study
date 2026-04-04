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

    const systemPrompt = `You are an impartial Answer Evaluator for a senior frontend developer study system.
Mission type: ${typeLabel}
Category: ${input.categoryName}

Evaluate whether the answer demonstrates senior-level competency:
- Has clear reasoning and evidence (not just opinions)
- Mentions trade-offs and alternatives
- Shows practical, real-world experience
- Communicates in a structured, conclusion-first manner
- Anticipates counterarguments or edge cases

STRICT OUTPUT FORMAT REQUIRED - follow exactly.

IMPORTANT: Respond in Korean (한국어).`;

    const userPrompt = `## 질문
${input.question}

## 답변 (시도 #${input.attemptNumber})
${input.userAnswer}

${input.previousFeedback ? `## 이전 피드백\n${input.previousFeedback}\n` : ""}

반드시 아래 형식으로 응답해주세요:

**Score: [0-100]/100**
**Verdict: [PASS|RETRY]**

### 강점
- [구체적 강점 1]
- [구체적 강점 2]

### 개선점
- [구체적 개선 제안 1]
- [구체적 개선 제안 2]

### 추천 학습 자료 (RETRY인 경우)
- [공부할 개념이나 키워드]`;

    return {
      systemPrompt,
      userPrompt,
      fullClipboardText: `${systemPrompt}\n\n---\n\n${userPrompt}`,
    };
  },
};

export default answerEvaluator;
