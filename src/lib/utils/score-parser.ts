export interface ParsedEvaluation {
  score: number | null;
  passed: boolean | null;
  feedbackSummary: string | null;
}

/**
 * AI 평가 응답에서 점수와 판정을 추출한다.
 * 다양한 포맷을 지원:
 * - "Score: 85/100"
 * - "**Score: 85/100**"
 * - "Score: 85"
 * - "점수: 85/100"
 */
export function parseEvaluation(evalText: string): ParsedEvaluation {
  const result: ParsedEvaluation = {
    score: null,
    passed: null,
    feedbackSummary: null,
  };

  if (!evalText) return result;

  // 점수 추출 - 다양한 패턴 시도
  const scorePatterns = [
    /\*?\*?Score:\s*(\d{1,3})\s*\/\s*100\*?\*?/i,
    /\*?\*?점수:\s*(\d{1,3})\s*\/\s*100\*?\*?/i,
    /\*?\*?Score:\s*(\d{1,3})\*?\*?/i,
    /\*?\*?점수:\s*(\d{1,3})\*?\*?/i,
    /(\d{1,3})\s*\/\s*100/,
  ];

  for (const pattern of scorePatterns) {
    const match = evalText.match(pattern);
    if (match) {
      const score = parseInt(match[1], 10);
      if (score >= 0 && score <= 100) {
        result.score = score;
        break;
      }
    }
  }

  // 판정 추출
  const verdictPatterns = [
    /\*?\*?Verdict:\s*(PASS|RETRY|FAIL)\*?\*?/i,
    /\*?\*?판정:\s*(통과|재시도|실패)\*?\*?/i,
  ];

  for (const pattern of verdictPatterns) {
    const match = evalText.match(pattern);
    if (match) {
      const verdict = match[1].toUpperCase();
      result.passed = verdict === "PASS" || verdict === "통과";
      break;
    }
  }

  // 점수 기반 판정 폴백 (verdict 없을 때)
  if (result.passed === null && result.score !== null) {
    result.passed = result.score >= 80;
  }

  // 피드백 요약 추출 (### Feedback 또는 ### 피드백 이후 텍스트)
  const feedbackMatch = evalText.match(
    /###\s*(?:Feedback|피드백|Areas for Improvement|개선점)\s*\n([\s\S]*?)(?=###|$)/i,
  );
  if (feedbackMatch) {
    result.feedbackSummary = feedbackMatch[1].trim().slice(0, 500);
  }

  return result;
}
