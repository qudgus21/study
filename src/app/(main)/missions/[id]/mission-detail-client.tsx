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
import { EvalPromptDisplay } from "@/components/missions/eval-prompt-display";
import { EvalResultInput } from "@/components/missions/eval-result-input";
import { ScoreBadge } from "@/components/missions/score-badge";
import { useMissionStore } from "@/stores/mission-store";
import { getAgentForMission, getAgent, type MissionType } from "@/lib/agents";
import { copyToClipboard } from "@/lib/utils/clipboard";
import { Skeleton } from "@/components/ui/skeleton";

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

export function MissionDetailClient({ missionId }: { missionId: string }) {
  const router = useRouter();
  const [mission, setMission] = useState<MissionDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    step,
    draftAnswer,
    generatedPrompt,
    parsedScore,
    setCurrentMission,
    setGeneratedPrompt,
    setStep,
    reset,
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

  const handleGeneratePrompt = useCallback(() => {
    if (!mission || !draftAnswer.trim()) {
      toast.error("답변을 먼저 작성해주세요.");
      return;
    }

    const agent = getAgentForMission(mission.missionType);
    const lastFeedback =
      mission.attempts.length > 0
        ? mission.attempts[mission.attempts.length - 1]?.feedbackSummary
        : undefined;

    const prompt = agent.generatePrompt({
      missionType: mission.missionType,
      question: mission.topicTitle,
      userAnswer: draftAnswer,
      codeSnippet: mission.codeSnippet ?? undefined,
      attemptNumber: mission.attempts.length + 1,
      previousFeedback: lastFeedback ?? undefined,
      categoryName: mission.categoryName,
    });

    setGeneratedPrompt(prompt.fullClipboardText);
  }, [mission, draftAnswer, setGeneratedPrompt]);

  const handleEvalSubmit = useCallback(
    async (evalResult: string, score: number, passed: boolean) => {
      if (!mission) return;

      try {
        const res = await fetch("/api/attempts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mission_id: mission.id,
            answer_text: draftAnswer,
            eval_prompt: generatedPrompt ?? "",
            eval_result: evalResult,
            score,
            passed,
            feedback_summary: evalResult.slice(0, 500),
          }),
        });

        if (!res.ok) throw new Error("Failed to submit");

        // 로컬 상태 업데이트
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

        setStep("result");
        toast.success(passed ? "통과! 잘했습니다!" : "아쉽네요. 다시 도전해보세요.");
      } catch (error) {
        console.error("Failed to submit evaluation:", error);
        toast.error("평가 저장에 실패했습니다.");
      }
    },
    [mission, draftAnswer, generatedPrompt, setStep],
  );

  const handleRetry = () => {
    reset();
    setCurrentMission(missionId);
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
            <p className="text-xs whitespace-pre-wrap">
              {mission.attempts[mission.attempts.length - 1]?.feedbackSummary}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 3단계 탭 */}
      <Tabs value={step} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="answering" onClick={() => setStep("answering")}>
            1. 답변
          </TabsTrigger>
          <TabsTrigger value="evaluating" disabled={!generatedPrompt}>
            2. 평가
          </TabsTrigger>
          <TabsTrigger value="result" disabled={parsedScore === null}>
            3. 결과
          </TabsTrigger>
        </TabsList>

        <TabsContent value="answering" className="mt-4 space-y-4">
          <AnswerEditor />
          <Button onClick={handleGeneratePrompt} disabled={!draftAnswer.trim()}>
            평가 프롬프트 생성 →
          </Button>
        </TabsContent>

        <TabsContent value="evaluating" className="mt-4 space-y-6">
          <EvalPromptDisplay />
          <EvalResultInput onSubmit={handleEvalSubmit} />
        </TabsContent>

        <TabsContent value="result" className="mt-4 space-y-4">
          {parsedScore !== null && (
            <div className="space-y-4">
              <div className="flex items-center justify-center py-6">
                <ScoreBadge score={parsedScore} size="lg" />
              </div>

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
                          if (!mission || !draftAnswer.trim()) return;
                          const juniorAgent = getAgent("junior-colleague");
                          const prompt = juniorAgent.generatePrompt({
                            missionType: mission.missionType,
                            question: mission.topicTitle,
                            userAnswer: draftAnswer,
                            codeSnippet: mission.codeSnippet ?? undefined,
                            attemptNumber: mission.attempts.length,
                            categoryName: mission.categoryName,
                          });
                          copyToClipboard(prompt.fullClipboardText)
                            .then(() =>
                              toast.success("주니어 동료 프롬프트가 클립보드에 복사됐습니다!"),
                            )
                            .catch(() => toast.error("복사에 실패했습니다."));
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
