"use client";

import { useEffect, useRef } from "react";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { useMissionStore } from "@/stores/mission-store";
import { Button } from "@/components/ui/button";
import { Loader2, AlertCircle } from "lucide-react";

interface EvalStreamingDisplayProps {
  onRetryEval: () => void;
}

export function EvalStreamingDisplay({ onRetryEval }: EvalStreamingDisplayProps) {
  const { streamingText, isEvaluating, evalError } = useMissionStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingText]);

  if (evalError) {
    return (
      <div className="space-y-3 rounded-lg border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm font-medium">평가 중 오류가 발생했습니다</p>
        </div>
        <p className="text-muted-foreground text-xs">{evalError}</p>
        {streamingText && (
          <details className="mt-2">
            <summary className="text-muted-foreground cursor-pointer text-xs">
              부분 응답 보기
            </summary>
            <div className="mt-2 max-h-[300px] overflow-auto rounded bg-black/5 p-3">
              <MarkdownContent>{streamingText}</MarkdownContent>
            </div>
          </details>
        )}
        <Button variant="outline" size="sm" onClick={onRetryEval}>
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">AI 평가</label>
        {isEvaluating && (
          <span className="flex items-center gap-1 text-xs text-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" />
            평가 중...
          </span>
        )}
      </div>

      <div
        ref={scrollRef}
        className="max-h-[500px] min-h-[200px] overflow-auto rounded-lg border bg-black/5 p-4"
      >
        {streamingText ? (
          <div>
            <MarkdownContent>{streamingText}</MarkdownContent>
            {isEvaluating && <span className="animate-pulse text-blue-500">▌</span>}
          </div>
        ) : isEvaluating ? (
          <div className="flex h-[180px] items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
              <p className="text-muted-foreground text-sm">
                Claude Code가 답변을 평가하고 있습니다...
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
