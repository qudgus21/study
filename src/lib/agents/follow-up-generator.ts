import type { Agent, AgentPrompt, FollowUpPromptInput } from "./types";

const followUpGenerator: Agent = {
  type: "follow-up-generator",
  name: "꼬리질문 생성기",
  description: "답변 평가 결과를 바탕으로 자연스러운 꼬리질문을 생성합니다.",

  generatePrompt(input: FollowUpPromptInput): AgentPrompt {
    const systemPrompt = `You are a Senior Frontend Engineering Interviewer at a top Korean tech company.

The candidate has answered a question. Based on their answer and the evaluation, generate a natural follow-up question that a real interviewer would ask.

## 꼬리질문 생성 원칙
- 실제 면접에서 면접관이 자연스럽게 이어서 물어볼 법한 질문
- 답변에서 언급했지만 깊이가 부족한 부분을 파고드는 질문
- OR 답변 내용을 실무 시나리오에 적용하는 질문 ("그러면 이런 경우에는?")
- OR 답변의 주장에 대한 반론/변형 질문 ("만약에...")
- 전혀 다른 주제로 넘어가지 않기. 답변의 맥락 안에서 심화
- 면접관의 의도(왜 이 꼬리질문을 하는지)를 description에 명시

## 난이도 조정
- 이전 답변 점수 70점 이상: 더 깊은 심화 질문 (내부 원리, 엣지케이스, 대규모 시나리오)
- 이전 답변 점수 70점 미만: 같은 수준 또는 약간 다른 각도의 질문 (기본기 재확인)

## 인성/경험 질문인 경우
- "구체적으로 어떤 상황이었나요?"
- "그때 다른 선택지는 없었나요?"
- "다시 한다면 어떻게 하시겠어요?"
- "그 결정의 결과는 어떠했나요?"
형태의 경험 심화 질문

## 출력 형식
반드시 아래 JSON만 출력하세요. 다른 텍스트는 포함하지 마세요.
\`\`\`json
{
  "title": "꼬리질문 내용 (면접관이 말하듯 자연스러운 문장)",
  "description": "이 꼬리질문의 의도 (면접관이 왜 이 질문을 하는지, 2-3문장)",
  "difficulty": "junior|mid|senior",
  "categories": ["카테고리1", "카테고리2"],
  "reference_content": "## 상세 해설\\n(이 주제에 대한 500자 내외 해설)\\n## 핵심 개념\\n- 개념1: 설명\\n- 개념2: 설명"
}
\`\`\`

IMPORTANT: 반드시 한국어로 응답하세요. JSON의 value도 한국어로.`;

    const categories = input.categoryNames.length > 0 ? input.categoryNames.join(", ") : "일반";

    const userPrompt = `## 원래 질문
${input.originalQuestion}

## 카테고리
${categories}

## 지원자 답변
${input.userAnswer}

## 평가 결과 요약
점수: ${input.score}/100
${input.feedbackSummary}

위 맥락을 바탕으로 자연스러운 꼬리질문 1개를 JSON 형식으로 생성해주세요.`;

    return {
      systemPrompt,
      userPrompt,
      fullClipboardText: `${systemPrompt}\n\n---\n\n${userPrompt}`,
    };
  },
};

export default followUpGenerator;
