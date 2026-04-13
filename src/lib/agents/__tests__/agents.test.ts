import { describe, it, expect } from "vitest";
import { getAgent } from "../index";

describe("Agent System", () => {
  describe("getAgent", () => {
    it("interview-evaluator 에이전트가 존재한다", () => {
      const agent = getAgent("interview-evaluator");
      expect(agent.name).toBe("면접 평가관");
      expect(agent.type).toBe("interview-evaluator");
    });

    it("follow-up-generator 에이전트가 존재한다", () => {
      const agent = getAgent("follow-up-generator");
      expect(agent.name).toBe("꼬리질문 생성기");
      expect(agent.type).toBe("follow-up-generator");
    });
  });

  describe("interview-evaluator 프롬프트 생성", () => {
    it("질문과 답변이 포함된다", () => {
      const agent = getAgent("interview-evaluator");
      const prompt = agent.generatePrompt({
        questionTitle: "클로저란 무엇인가요?",
        userAnswer: "함수 안에 함수가 있을 때 바깥 변수를 참조하는 것",
        attemptNumber: 1,
        categoryNames: ["JavaScript"],
      });

      expect(prompt.systemPrompt).toContain("Frontend Engineering Interviewer");
      expect(prompt.userPrompt).toContain("클로저");
      expect(prompt.userPrompt).toContain("JavaScript");
      expect(prompt.fullClipboardText).toContain("Score:");
    });

    it("재시도 시 이전 피드백이 반영된다", () => {
      const agent = getAgent("interview-evaluator");
      const prompt = agent.generatePrompt({
        questionTitle: "클로저란 무엇인가요?",
        userAnswer: "렉시컬 환경에서 외부 스코프 변수를 참조하는 함수",
        attemptNumber: 2,
        previousFeedback: "메모리 누수 관련 설명이 부족합니다.",
        categoryNames: ["JavaScript"],
      });

      expect(prompt.userPrompt).toContain("시도 #2");
      expect(prompt.userPrompt).toContain("메모리 누수");
    });

    it("코드 스니펫이 포함된다", () => {
      const agent = getAgent("interview-evaluator");
      const prompt = agent.generatePrompt({
        questionTitle: "이 코드의 성능 문제를 찾아주세요",
        userAnswer: "불필요한 리렌더링이 발생합니다",
        attemptNumber: 1,
        categoryNames: ["React", "성능 최적화"],
        codeSnippet: "function App() { return items.map(i => <Item key={i} />) }",
      });

      expect(prompt.userPrompt).toContain("function App()");
      expect(prompt.userPrompt).toContain("React, 성능 최적화");
    });
  });

  describe("follow-up-generator 프롬프트 생성", () => {
    it("원래 질문, 답변, 점수가 포함된다", () => {
      const agent = getAgent("follow-up-generator");
      const prompt = agent.generatePrompt({
        originalQuestion: "클로저란 무엇인가요?",
        userAnswer: "함수 안에 함수가 있을 때 바깥 변수를 참조하는 것",
        score: 75,
        feedbackSummary: "기본 개념은 맞지만 깊이 부족",
        categoryNames: ["JavaScript"],
      });

      expect(prompt.systemPrompt).toContain("꼬리질문");
      expect(prompt.userPrompt).toContain("75/100");
      expect(prompt.userPrompt).toContain("클로저");
      expect(prompt.userPrompt).toContain("JavaScript");
    });
  });
});
