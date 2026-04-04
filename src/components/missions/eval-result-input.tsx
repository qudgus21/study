"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useMissionStore } from "@/stores/mission-store";
import { parseEvaluation } from "@/lib/utils/score-parser";

interface EvalResultInputProps {
  onSubmit: (evalResult: string, score: number, passed: boolean) => void;
}

export function EvalResultInput({ onSubmit }: EvalResultInputProps) {
  const { evalResult, setEvalResult, setParsedScore } = useMissionStore();
  const [manualScore, setManualScore] = useState<string>("");
  const [parseError, setParseError] = useState(false);

  const handleSubmit = () => {
    if (!evalResult) return;

    const parsed = parseEvaluation(evalResult);

    if (parsed.score !== null) {
      setParseError(false);
      setParsedScore(parsed.score);
      onSubmit(evalResult, parsed.score, parsed.passed ?? parsed.score >= 80);
    } else if (manualScore) {
      const score = parseInt(manualScore, 10);
      if (score >= 0 && score <= 100) {
        setParsedScore(score);
        onSubmit(evalResult, score, score >= 80);
      }
    } else {
      setParseError(true);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Claude 응답 붙여넣기</label>
      <Textarea
        value={evalResult ?? ""}
        onChange={(e) => {
          setEvalResult(e.target.value);
          setParseError(false);
        }}
        placeholder="claude.ai에서 받은 평가 응답을 여기에 붙여넣기 하세요."
        className="min-h-[200px] resize-y font-mono text-xs"
      />

      {parseError && (
        <div className="space-y-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
          <p className="text-sm text-yellow-600">
            점수를 자동으로 파싱하지 못했습니다. 수동으로 입력해주세요.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={100}
              value={manualScore}
              onChange={(e) => setManualScore(e.target.value)}
              placeholder="점수 (0-100)"
              className="w-32"
            />
            <span className="text-muted-foreground text-sm">/ 100</span>
          </div>
        </div>
      )}

      <Button onClick={handleSubmit} disabled={!evalResult}>
        평가 제출
      </Button>
    </div>
  );
}
