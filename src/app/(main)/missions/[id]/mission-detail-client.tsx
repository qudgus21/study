"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookOpen, MessageSquare, Code, Users } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnswerEditor } from "@/components/missions/answer-editor";
import { EvalStreamingDisplay } from "@/components/missions/eval-streaming-display";
import { ScoreBadge } from "@/components/missions/score-badge";
import { useMissionStore } from "@/stores/mission-store";
import { parseEvaluation } from "@/lib/utils/score-parser";
import type { MissionType } from "@/lib/agents";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownContent } from "@/components/ui/markdown-content";

interface MissionDetail {
  id: string;
  missionType: MissionType;
  status: string;
  topicTitle: string;
  topicDescription: string | null;
  codeSnippet: string | null;
  categoryName: string;
  attempts: Array<{
    id: string;
    score: number | null;
    passed: boolean;
    feedbackSummary: string | null;
    createdAt: string;
  }>;
}

const typeIcons = {
  concept: BookOpen,
  discussion: MessageSquare,
  code: Code,
};

const typeLabels = {
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

export function MissionDetailClient({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    async function fetchMission() {
      try {
        const res = await fetch(`/api/missions/${missionId}`);
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        setMission({
          id: data.id,
          missionType: data.mission_type as MissionType,
          status: data.status,
          topicTitle: data.topic_title ?? "",
          topicDescription: data.topic_description ?? null,
          codeSnippet: data.code_snippet ?? null,
          categoryName: data.category_name ?? "기타",
          attempts: (data.attempts ?? []).map((a: Record<string, unknown>) => ({
            id: a.id,
            score: a.score ?? null,
            passed: a.passed ?? false,
            feedbackSummary: a.feedback_summary ?? null,
            createdAt: a.created_at ?? "",
          })),
        });
      } catch (error) {
        console.error("Failed to fetch mission:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchMission();
  }, [missionId]);

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

        const newStatus = passed ? "passed" : "in_progress";
        setMission((prev) =>
          prev
            ? {
                ...prev,
                status: newStatus,
                attempts: [
                  ...prev.attempts,
                  {
                    id: "temp",
                    score,
                    passed,
                    feedbackSummary: evalResult.slice(0, 500),
                    createdAt: new Date().toISOString(),
                  },
                ],
              }
            : null,
        );

        setParsedScore(score);
        setStep("result");
        toast.success(passed ? "통과! 잘했습니다!" : "아쉽네요. 다시 도전해보세요.");
      } catch (error) {
        console.error("Failed to submit evaluation:", error);
        toast.error("평가 저장에 실패했습니다.");
      }
    },
    [mission, draftAnswer, setStep, setParsedScore],
  );

  const startEvaluation = useCallback(async () => {
    if (!mission || !draftAnswer.trim()) {
      toast.error("답변을 먼저 작성해주세요.");
      return;
    }

    const store = useMissionStore.getState();
    store.setIsEvaluating(true);
    store.setEvalError(null);
    // streamingText 초기화
    useMissionStore.setState({ streamingText: "" });
    setStep("evaluating");

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: mission.id,
          mission_type: mission.missionType,
          question: mission.topicTitle,
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
        // 마지막 불완전 이벤트를 버퍼에 유지
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

      // 평가 완료 — 점수 파싱 및 자동 저장
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

  const handleRetry = () => {
    resetForRetry();
  };

  if (loading) {
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
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5" />
          <Badge variant="outline">{typeLabels[mission.missionType]}</Badge>
          <Badge variant="outline">{mission.categoryName}</Badge>
        </div>
      </div>

      {/* 질문 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{mission.topicTitle}</CardTitle>
          {mission.topicDescription && (
            <p className="text-muted-foreground text-sm">{mission.topicDescription}</p>
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

              {/* 평가 내용 표시 */}
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
                          // TODO: Junior colleague도 CLI 연동으로 전환
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
    </div>
  );
}
