"use client";

import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { useMissionStore } from "@/stores/mission-store";

export function EvalPromptDisplay() {
  const { generatedPrompt } = useMissionStore();
  const [copied, setCopied] = useState(false);

  if (!generatedPrompt) return null;

  const handleCopy = async () => {
    const success = await copyToClipboard(generatedPrompt);
    if (success) {
      setCopied(true);
      toast.success("클립보드에 복사되었습니다. claude.ai에 붙여넣기 하세요!");
      setTimeout(() => setCopied(false), 3000);
    } else {
      toast.error("복사에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">평가 프롬프트</label>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="mr-1 h-3 w-3" /> 복사됨
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3 w-3" /> 클립보드 복���
            </>
          )}
        </Button>
      </div>
      <ScrollArea className="bg-muted h-[300px] rounded-lg border p-4">
        <pre className="text-xs whitespace-pre-wrap">{generatedPrompt}</pre>
      </ScrollArea>
      <p className="text-muted-foreground text-xs">
        위 프롬프트를 복사해서 <strong>claude.ai</strong>에 붙여넣기 하세요. AI의 응답을 아래에
        붙여넣기 합니다.
      </p>
    </div>
  );
}
