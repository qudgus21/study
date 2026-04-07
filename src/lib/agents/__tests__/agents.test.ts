import { describe, it, expect } from "vitest";
import { getAgentForMission, getAgent } from "../index";

describe("Agent System", () => {
  describe("getAgentForMission", () => {
    it("concept 미션에 senior-interviewer를 반환한다", () => {
      const agent = getAgentForMission("concept");
      expect(agent.type).toBe("senior-interviewer");
    });

    it("discussion 미션에 tech-lead-debater를 반환한다", () => {
      const agent = getAgentForMission("discussion");
      expect(agent.type).toBe("tech-lead-debater");
    });

    it("code 미션에 strict-code-reviewer를 반환한다", () => {
      const agent = getAgentForMission("code");
      expect(agent.type).toBe("strict-code-reviewer");
    });
  });

  describe("getAgent", () => {
    it("모든 에이전트 타입에 접근할 수 있다", () => {
      expect(getAgent("senior-interviewer").name).toBe("시니어 면접관");
      expect(getAgent("tech-lead-debater").name).toBe("테크리드 토론자");
      expect(getAgent("strict-code-reviewer").name).toBe("엄격한 코드 리뷰어");
      expect(getAgent("junior-colleague").name).toBe("주니어 동료");
      expect(getAgent("answer-evaluator").name).toBe("답변 평가자");
    });
  });

  describe("generatePrompt", () => {
    const baseInput = {
      missionType: "concept" as const,
      question: "React Fiber 아키텍처를 설명해주세요",
      userAnswer: "React Fiber는 React 16에서 도입된 새로운 재조정 엔진입니다.",
      attemptNumber: 1,
      categoryName: "React",
    };

    it("senior-interviewer 프롬프트에 질문과 답변이 포함된다", () => {
      const agent = getAgentForMission("concept");
      const prompt = agent.generatePrompt(baseInput);

      expect(prompt.fullClipboardText).toContain("React Fiber");
      expect(prompt.fullClipboardText).toContain("재조정 엔진");
      expect(prompt.fullClipboardText).toContain("Score:");
      expect(prompt.systemPrompt).toContain("Senior Frontend Engineering Interviewer");
    });

    it("tech-lead-debater 프롬프트에 반론 요청이 포함된다", () => {
      const agent = getAgentForMission("discussion");
      const prompt = agent.generatePrompt({
        ...baseInput,
        missionType: "discussion",
        question: "모노레포 전환을 제안받았습니다. 의견은?",
      });

      expect(prompt.fullClipboardText).toContain("모노레포");
      expect(prompt.systemPrompt).toContain("Tech Lead");
      expect(prompt.systemPrompt).toContain("반론");
    });

    it("strict-code-reviewer 프롬프트에 코드 스니펫이 포함된다", () => {
      const agent = getAgentForMission("code");
      const prompt = agent.generatePrompt({
        ...baseInput,
        missionType: "code",
        question: "이 코드의 성능 문제를 찾아주세요",
        codeSnippet: "function App() { return items.map(i => <Item key={i} />) }",
      });

      expect(prompt.fullClipboardText).toContain("function App()");
      expect(prompt.systemPrompt).toContain("Staff Engineer");
    });

    it("재시도 시 이전 피드백이 포함된다", () => {
      const agent = getAgentForMission("concept");
      const prompt = agent.generatePrompt({
        ...baseInput,
        attemptNumber: 2,
        previousFeedback: "Fiber의 우선순위 시스템에 대한 설명이 부족합니다.",
      });

      expect(prompt.fullClipboardText).toContain("우선순위 시스템");
      expect(prompt.fullClipboardText).toContain("시도 #2");
    });
  });
});
