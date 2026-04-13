"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  MessageSquare,
  Code,
  Users,
  Lightbulb,
  X,
  FileText,
  Zap,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { blockIfDemo } from "@/lib/demo-mode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnswerEditor } from "@/components/missions/answer-editor";
import { EvalStreamingDisplay } from "@/components/missions/eval-streaming-display";
import { ScoreBadge } from "@/components/missions/score-badge";
import { useMissionStore } from "@/stores/mission-store";
import { parseEvaluation } from "@/lib/utils/score-parser";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { useMission, useInvalidateMission } from "@/lib/queries/use-missions";

// TODO: Phase 4에서 question-detail-client.tsx로 전면 교체 예정
const typeIcons: Record<string, typeof BookOpen> = {
  concept: BookOpen,
  discussion: MessageSquare,
  code: Code,
};

const typeLabels: Record<string, string> = {
  concept: "개념 설명",
  discussion: "기술 토론",
  code: "코드 챌린지",
};

function parseSSEEvents(chunk: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const lines = chunk.split("\n");
  let currentEvent = "";
  let currentData = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      currentEvent = line.slice(7);
    } else if (line.startsWith("data: ")) {
      currentData = line.slice(6);
    } else if (line === "" && currentEvent && currentData) {
      events.push({ event: currentEvent, data: currentData });
      currentEvent = "";
      currentData = "";
    }
  }

  return events;
}

interface ReferenceSection {
  type: "detail" | "concepts" | "links" | "unknown";
  title: string;
  content: string;
}

function parseReferenceSections(content: string): ReferenceSection[] {
  const sections: ReferenceSection[] = [];
  const parts = content.split(/^## /m).filter(Boolean);

  for (const part of parts) {
    const newlineIdx = part.indexOf("\n");
    const title = (newlineIdx >= 0 ? part.slice(0, newlineIdx) : part).trim();
    const body = newlineIdx >= 0 ? part.slice(newlineIdx + 1).trim() : "";

    let type: ReferenceSection["type"] = "unknown";
    if (/상세\s*해설/.test(title)) type = "detail";
    else if (/핵심\s*개념/.test(title)) type = "concepts";
    else if (/참고글|참고\s*자료|레퍼런스/.test(title)) type = "links";

    sections.push({ type, title, content: body });
  }

  return sections;
}

function parseLinkItems(content: string): Array<{ title: string; url: string; desc: string }> {
  const items: Array<{ title: string; url: string; desc: string }> = [];
  const lines = content.split("\n").filter((l) => l.trim());

  for (const line of lines) {
    const match = line.match(/\[([^\]]+)\]\(([^)]+)\)(?:\s*[—\-–:]\s*(.*))?/);
    if (match) {
      items.push({ title: match[1], url: match[2], desc: match[3]?.trim() ?? "" });
    }
  }

  return items;
}

function ReferencePanelContent({ content }: { content: string }) {
  const sections = parseReferenceSections(content);

  // fallback: 섹션 파싱이 안 되면 기존 마크다운 렌더링
  if (sections.length === 0) {
    return (
      <div className="p-4">
        <MarkdownContent>{content}</MarkdownContent>
      </div>
    );
  }

  const sectionIcons = {
    detail: FileText,
    concepts: Zap,
    links: ExternalLink,
    unknown: BookOpen,
  };

  const sectionColors = {
    detail: "border-blue-500/20 bg-blue-500/5",
    concepts: "border-amber-500/20 bg-amber-500/5",
    links: "border-emerald-500/20 bg-emerald-500/5",
    unknown: "border-border bg-muted/30",
  };

  const iconColors = {
    detail: "text-blue-500",
    concepts: "text-amber-500",
    links: "text-emerald-500",
    unknown: "text-muted-foreground",
  };

  return (
    <div className="space-y-3 p-4">
      {sections.map((section, i) => {
        const SectionIcon = sectionIcons[section.type];

        // 참고글 섹션은 링크 카드로 렌더링
        if (section.type === "links") {
          const linkItems = parseLinkItems(section.content);
          return (
            <div key={i} className={`rounded-lg border ${sectionColors[section.type]} p-4`}>
              <div className="mb-3 flex items-center gap-2">
                <SectionIcon className={`h-4 w-4 ${iconColors[section.type]}`} />
                <h3 className="text-sm font-semibold">{section.title}</h3>
              </div>
              {linkItems.length > 0 ? (
                <div className="space-y-2">
                  {linkItems.map((item, j) => (
                    <a
                      key={j}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="border-border/50 hover:border-border hover:bg-card group block rounded-md border bg-white/50 p-3 transition-colors dark:bg-white/5"
                    >
                      <div className="flex items-start gap-2">
                        <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500 opacity-60 group-hover:opacity-100" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm leading-snug font-medium group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                            {item.title}
                          </p>
                          {item.desc && (
                            <p className="text-muted-foreground mt-0.5 text-xs leading-relaxed">
                              {item.desc}
                            </p>
                          )}
                          <p className="mt-1 truncate text-[11px] text-emerald-600/60">
                            {item.url
                              .replace(/^https?:\/\//, "")
                              .split("/")
                              .slice(0, 2)
                              .join("/")}
                          </p>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="ref-links-section">
                  <MarkdownContent>{section.content}</MarkdownContent>
                </div>
              )}
            </div>
          );
        }

        // 상세 해설 / 핵심 개념 / 기타
        return (
          <div key={i} className={`rounded-lg border ${sectionColors[section.type]} p-4`}>
            <div className="mb-2 flex items-center gap-2">
              <SectionIcon className={`h-4 w-4 ${iconColors[section.type]}`} />
              <h3 className="text-sm font-semibold">{section.title}</h3>
            </div>
            <div className="ref-section-content">
              <MarkdownContent>{section.content}</MarkdownContent>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MissionDetailClient({ missionId }: { missionId: string }) {
  const router = useRouter();
  const { data: mission, isLoading } = useMission(missionId);
  const invalidateMission = useInvalidateMission();

  const {
    step,
    draftAnswer,
    parsedScore,
    sessionId,
    isEvaluating,
    streamingText,
    setCurrentMission,
    setStep,
    setParsedScore,
    setSessionId,
    setIsEvaluating,
    appendStreamingText,
    setEvalError,
    resetForRetry,
  } = useMissionStore();

  useEffect(() => {
    setCurrentMission(missionId);
  }, [missionId, setCurrentMission]);

  const saveAttempt = useCallback(
    async (evalResult: string, score: number, passed: boolean) => {
      if (!mission) return;

      try {
        const res = await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mission_id: mission.id,
            answer_text: draftAnswer,
            eval_prompt: "",
            eval_result: evalResult,
            score,
            passed,
            feedback_summary: evalResult.slice(0, 500),
          }),
        });

        if (!res.ok) throw new Error("Failed to submit");

        // 서버 데이터 갱신
        invalidateMission(missionId);

        setParsedScore(score);
        setStep("result");
        toast.success(passed ? "통과! 잘했습니다!" : "아쉽네요. 다시 도전해보세요.");
      } catch (error) {
        console.error("Failed to submit evaluation:", error);
        toast.error("평가 저장에 실패했습니다.");
      }
    },
    [mission, draftAnswer, missionId, setStep, setParsedScore, invalidateMission],
  );

  const startEvaluation = useCallback(async () => {
    if (blockIfDemo()) return;
    if (!mission || !draftAnswer.trim()) {
      toast.error("답변을 먼저 작성해주세요.");
      return;
    }

    const store = useMissionStore.getState();
    store.setIsEvaluating(true);
    store.setEvalError(null);
    useMissionStore.setState({ streamingText: "" });
    setStep("evaluating");

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: mission.id,
          mission_type: mission.missionType,
          question: mission.title,
          answer: draftAnswer,
          category_name: mission.categoryName,
          code_snippet: mission.codeSnippet ?? undefined,
          attempt_number: mission.attempts.length + 1,
          session_id: sessionId ?? undefined,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error("평가 요청에 실패했습니다.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let newSessionId: string | null = null;
      let sseBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const events = parseSSEEvents(sseBuffer);
        const lastNewline = sseBuffer.lastIndexOf("\n\n");
        sseBuffer = lastNewline >= 0 ? sseBuffer.slice(lastNewline + 2) : sseBuffer;

        for (const evt of events) {
          try {
            const data = JSON.parse(evt.data);

            switch (evt.event) {
              case "text":
                if (data.content) {
                  fullText += data.content;
                  appendStreamingText(data.content);
                }
                break;
              case "session":
                if (data.session_id) {
                  newSessionId = data.session_id;
                  setSessionId(data.session_id);
                }
                break;
              case "done":
                if (data.session_id && !newSessionId) {
                  setSessionId(data.session_id);
                }
                break;
              case "error":
                throw new Error(data.message || "평가 중 오류 발생");
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== evt.data) {
              throw parseErr;
            }
          }
        }
      }

      if (fullText) {
        const parsed = parseEvaluation(fullText);
        const score = parsed.score ?? 0;
        const passed = parsed.passed ?? score >= 80;
        await saveAttempt(fullText, score, passed);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "알 수 없는 오류";
      setEvalError(message);
    } finally {
      setIsEvaluating(false);
    }
  }, [
    mission,
    draftAnswer,
    sessionId,
    setStep,
    appendStreamingText,
    setSessionId,
    setEvalError,
    setIsEvaluating,
    saveAttempt,
  ]);

  const [referenceOpen, setReferenceOpen] = useState(false);

  const handleRetry = () => {
    resetForRetry();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!mission) {
    return <p className="text-muted-foreground">미션을 찾을 수 없습니다.</p>;
  }

  const Icon = typeIcons[mission.missionType];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/missions">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex flex-1 items-center gap-2">
          <Icon className="h-5 w-5" />
          <Badge variant="outline">{typeLabels[mission.missionType]}</Badge>
          <Badge variant="outline">{mission.categoryName}</Badge>
        </div>
        {mission.referenceContent && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setReferenceOpen(true)}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            참고자료
          </Button>
        )}
      </div>

      {/* 질문 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{mission.title}</CardTitle>
          {mission.description && (
            <p className="text-muted-foreground text-sm">{mission.description}</p>
          )}
        </CardHeader>
        {mission.codeSnippet && (
          <CardContent>
            <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-sm">
              <code>{mission.codeSnippet}</code>
            </pre>
          </CardContent>
        )}
      </Card>

      {/* 이전 시도 피드백 */}
      {mission.attempts.length > 0 && step === "answering" && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardContent className="p-4">
            <p className="mb-2 text-sm font-medium text-yellow-600">
              이전 피드백 (시도 #{mission.attempts.length})
            </p>
            <div>
              <MarkdownContent>
                {mission.attempts[mission.attempts.length - 1]?.feedbackSummary ?? ""}
              </MarkdownContent>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3단계 탭 */}
      <Tabs value={step} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger
            value="answering"
            onClick={() => setStep("answering")}
            disabled={isEvaluating}
          >
            1. 답변
          </TabsTrigger>
          <TabsTrigger value="evaluating" disabled={!isEvaluating && !streamingText}>
            2. 평가
          </TabsTrigger>
          <TabsTrigger value="result" disabled={parsedScore === null}>
            3. 결과
          </TabsTrigger>
        </TabsList>

        <TabsContent value="answering" className="mt-4 space-y-4">
          <AnswerEditor />
          <Button onClick={startEvaluation} disabled={!draftAnswer.trim() || isEvaluating}>
            평가 시작 →
          </Button>
        </TabsContent>

        <TabsContent value="evaluating" className="mt-4 space-y-6">
          <EvalStreamingDisplay onRetryEval={startEvaluation} />
        </TabsContent>

        <TabsContent value="result" className="mt-4 space-y-4">
          {parsedScore !== null && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-6">
                <ScoreBadge score={parsedScore} size="lg" />
              </div>

              {streamingText && (
                <Card>
                  <CardContent className="max-h-[400px] overflow-auto p-4">
                    <MarkdownContent>{streamingText}</MarkdownContent>
                  </CardContent>
                </Card>
              )}

              {parsedScore >= 80 ? (
                <Card className="border-green-500/20 bg-green-500/5">
                  <CardContent className="space-y-3 p-4 text-center">
                    <p className="text-lg font-bold text-green-600">통과!</p>
                    <p className="text-muted-foreground text-sm">
                      잘했습니다. 다음 미션으로 넘어가세요.
                    </p>
                    <div className="flex justify-center gap-2">
                      <Button onClick={() => router.push("/missions")}>미션 목록으로</Button>
                      <Button
                        variant="outline"
                        className="gap-2"
                        onClick={() => {
                          toast.info("주니어 동료 기능은 준비 중입니다.");
                        }}
                      >
                        <Users className="h-3.5 w-3.5" />
                        주니어 동료에게 설명하기
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-yellow-500/20 bg-yellow-500/5">
                  <CardContent className="space-y-3 p-4">
                    <p className="font-medium text-yellow-600">아직 부족해요. 다시 도전해보세요!</p>
                    <p className="text-muted-foreground text-xs">
                      위 피드백을 참고해서 답변을 보강해보세요. 관련 아티클을 읽고 다시 시도하면
                      좋습니다.
                    </p>
                    <Button variant="outline" onClick={handleRetry}>
                      재시도
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 참고자료 슬라이드 패널 */}
      {mission.referenceContent && (
        <>
          {referenceOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/30"
              onClick={() => setReferenceOpen(false)}
            />
          )}
          <div
            className={`bg-card border-border fixed top-0 right-0 z-50 h-full w-full max-w-md border-l shadow-lg transition-transform duration-300 ${
              referenceOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4" />
                  <span className="text-sm font-medium">참고자료</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setReferenceOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <ReferencePanelContent content={mission.referenceContent} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
