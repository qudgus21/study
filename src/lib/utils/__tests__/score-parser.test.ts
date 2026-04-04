import { describe, it, expect } from "vitest";
import { parseEvaluation } from "../score-parser";

describe("parseEvaluation", () => {
  it("표준 포맷에서 점수와 판정을 추출한다", () => {
    const result = parseEvaluation(`
**Score: 85/100**
**Verdict: PASS**

### Feedback
좋은 답변입니다.
    `);

    expect(result.score).toBe(85);
    expect(result.passed).toBe(true);
  });

  it("RETRY 판정을 올바르게 파싱한다", () => {
    const result = parseEvaluation(`
**Score: 65/100**
**Verdict: RETRY**

### 개선점
더 깊이 있는 설명이 필요합니다.
    `);

    expect(result.score).toBe(65);
    expect(result.passed).toBe(false);
  });

  it("별표 없는 포맷도 파싱한다", () => {
    const result = parseEvaluation("Score: 90/100\nVerdict: PASS");
    expect(result.score).toBe(90);
    expect(result.passed).toBe(true);
  });

  it("한국어 포맷도 파싱한다", () => {
    const result = parseEvaluation("점수: 75/100\n판정: 재시도");
    expect(result.score).toBe(75);
    expect(result.passed).toBe(false);
  });

  it("verdict 없이 점수만 있으면 80점 기준으로 판정한다", () => {
    const result = parseEvaluation("Score: 82/100");
    expect(result.score).toBe(82);
    expect(result.passed).toBe(true);

    const result2 = parseEvaluation("Score: 79/100");
    expect(result2.score).toBe(79);
    expect(result2.passed).toBe(false);
  });

  it("빈 문자열이면 null을 반환한다", () => {
    const result = parseEvaluation("");
    expect(result.score).toBeNull();
    expect(result.passed).toBeNull();
  });

  it("파싱 불가능한 텍스트면 null을 반환한다", () => {
    const result = parseEvaluation("이것은 평가가 아닙니다.");
    expect(result.score).toBeNull();
    expect(result.passed).toBeNull();
  });

  it("피드백 섹션을 추출한다", () => {
    const result = parseEvaluation(`
**Score: 70/100**
**Verdict: RETRY**

### Feedback
- 트레이드오프 분석이 부족합니다
- 실무 경험 언급이 없습니다
    `);

    expect(result.feedbackSummary).toContain("트레이드오프");
  });

  it("점수가 0-100 범위를 벗어나면 무시한다", () => {
    const result = parseEvaluation("Score: 150/100");
    expect(result.score).toBeNull();
  });
});
