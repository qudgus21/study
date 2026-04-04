import type { Agent, AgentPrompt, AgentPromptInput } from "./types";

const strictCodeReviewer: Agent = {
  type: "strict-code-reviewer",
  name: "엄격한 코드 리뷰어",
  description: "Staff Engineer로서 코드 분석 및 리뷰 능력을 평가합니다.",

  generatePrompt(input: AgentPromptInput): AgentPrompt {
    const codeSection = input.codeSnippet
      ? `\n## 리뷰 대상 코드\n\`\`\`\n${input.codeSnippet}\n\`\`\`\n`
      : "";

    const systemPrompt = `You are a meticulous Staff Engineer conducting a code review.
You are reviewing the candidate's analysis of: "${input.question}"
${codeSection}
Your review standards:
- Every performance claim must have a "why" (Big-O, browser rendering pipeline, etc.)
- Demand specific fixes, not vague "optimize this"
- Check for: bundle size impact, render count, memory leaks, accessibility
- Value: measurable improvements, before/after comparisons, profiling methodology
- Look for: edge case handling, error boundaries, race conditions

Evaluation criteria (score 0-100):
1. Issue identification completeness (25pts): Did they find all the problems?
2. Root cause analysis depth (25pts): Do they understand WHY it's a problem?
3. Fix quality and specificity (20pts): Are the proposed fixes concrete and correct?
4. Performance measurement methodology (15pts): How would they verify the fix works?
5. Edge case and regression awareness (15pts): What could go wrong with the fix?

Passing score: 80/100

IMPORTANT: Respond in Korean (한국어).`;

    const userPrompt = `## 문제
${input.question}

## 개발자의 분석/답변 (시도 #${input.attemptNumber})
${input.userAnswer}

${input.previousFeedback ? `## 이전 피드백 (재시도 중)\n${input.previousFeedback}\n` : ""}
## 평가 요청
1. 위 루브릭에 따라 점수를 매겨주세요 (0-100)
2. 놓친 이슈가 있다면 지적해주세요
3. 분석이 피상적인 부분을 구체적으로 알려주세요
4. 80점 미만: 어떤 관점에서 더 분석해야 하는지 힌트를 주세요
5. 80점 이상: 분석의 강점과 추가 고려사항을 언급해주세요

반드시 아래 형식으로 응답해주세요:
**Score: [N]/100**
**Verdict: [PASS/RETRY]**

### 항목별 점수
- 이슈 식별: [N]/25
- 근본 원인 분석: [N]/25
- 수정안 품질: [N]/20
- 성능 측정: [N]/15
- 엣지케이스: [N]/15

### 강점
[구체적 강점]

### 놓친 이슈
[발견하지 못한 문제점]

### 개선점
[더 나은 분석을 위한 구체적 피드백]

### 후속 질문 (RETRY인 경우)
[코드 분석 깊이를 높이는 질문]`;

    return {
      systemPrompt,
      userPrompt,
      fullClipboardText: `${systemPrompt}\n\n---\n\n${userPrompt}`,
    };
  },
};

export default strictCodeReviewer;
