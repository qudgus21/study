"use client";

import { Textarea } from "@/components/ui/textarea";
import { useMissionStore } from "@/stores/mission-store";

export function AnswerEditor() {
  const { draftAnswer, setDraftAnswer } = useMissionStore();

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">내 답변</label>
        <span className="text-muted-foreground text-xs">{draftAnswer.length}자</span>
      </div>
      <Textarea
        value={draftAnswer}
        onChange={(e) => setDraftAnswer(e.target.value)}
        placeholder="시니어답게 답변을 작성해보세요. 근거, 트레이드오프, 실무 경험을 포함하면 좋습니다."
        className="min-h-[300px] resize-y font-mono text-sm"
      />
    </div>
  );
}
