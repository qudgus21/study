"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Send,
  RotateCcw,
  MessageCircleQuestion,
  FileText,
  ChevronRight,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownContent } from "@/components/ui/markdown-content";
import { useQuestion, useInvalidateQuestion } from "@/lib/queries/use-questions";
import { useQuestionStore } from "@/stores/question-store";
import { useSettings } from "@/lib/queries/use-settings";
import { parseEvaluation } from "@/lib/utils/score-parser";

const difficultyLabels: Record<string, string> = {
  junior: "Lv.1",
  mid: "Lv.2",
  senior: "Lv.3",
};

const difficultyColors: Record<string, string> = {
  junior: "bg-green-100 text-green-800",
  mid: "bg-blue-100 text-blue-800",
  senior: "bg-purple-100 text-purple-800",
};

export function QuestionDetailClient() {
  const params = useParams();
  const questionId = params.id as string;
  const router = useRouter();

  const { data: question, isLoading } = useQuestion(questionId);
  const { data: settings } = useSettings();
  const invalidateQuestion = useInvalidateQuestion();
  const passScore = settings?.pass_score ?? 80;

  const store = useQuestionStore();
  const [showReference, setShowReference] = useState(false);

  // 질문 변경 시 스토어 초기화
  useEffect(() => {
    if (questionId) store.setCurrentQuestion(questionId);
  }, [questionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 평가 시작
  const startEvaluation = useCallback(async () => {
    if (!question || !store.draftAnswer.trim()) return;

    store.setIsEvaluating(true);
    store.setStep("evaluating");
    store.setEvalError(null);

    const categoryNames = question.categories.map((c) => c.name);

    try {
      const res = await fetch("/api/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question_id: question.id,
          question_title: question.title,
          question_description: question.description,
          answer: store.draftAnswer,
          category_names: categoryNames,
          code_snippet: question.codeSnippet,
          attempt_number: (question.attempts?.length ?? 0) + 1,
          session_id: store.sessionId,
        }),
      });

      if (!res.ok) throw new Error("평가 요청 실패");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("스트림 없음");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) store.appendStreamingText(data.content);
              if (data.session_id) store.setSessionId(data.session_id);
              if (data.full_text) {
                store.setEvalResult(data.full_text);
                const parsed = parseEvaluation(data.full_text);
                store.setParsedScore(parsed.score);

                // attempt 저장
                await fetch("/api/attempts", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    question_id: question.id,
                    answer_text: store.draftAnswer,
                    eval_result: data.full_text,
                    score: parsed.score,
                    passed: parsed.passed ?? false,
                    feedback_summary: parsed.feedbackSummary,
                  }),
                });

                invalidateQuestion(question.id);
                store.setStep("result");
              }
              if (data.message) store.setEvalError(data.message);
            } catch {
              // ignore parse error
            }
          }
        }
      }
    } catch (err) {
      store.setEvalError(err instanceof Error ? err.message : "알 수 없는 오류");
    } finally {
      store.setIsEvaluating(false);
    }
  }, [question, store, invalidateQuestion]);

  // 꼬리질문 생성
  const generateFollowUp = useCallback(async () => {
    if (!question || !store.evalResult) return;

    store.setIsGeneratingFollowUp(true);
    try {
      const parsed = parseEvaluation(store.evalResult);
      const res = await fetch(`/api/questions/${question.id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_answer: store.draftAnswer,
          score: parsed.score ?? 0,
          feedback_summary: parsed.feedbackSummary ?? "",
        }),
      });

      if (!res.ok) throw new Error("꼬리질문 생성 실패");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.question_id) {
                router.push(`/questions/${data.question_id}`);
                return;
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      console.error("Follow-up generation failed:", err);
    } finally {
      store.setIsGeneratingFollowUp(false);
    }
  }, [question, store, router]);

  if (isLoading || !question) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">질문 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 py-5 md:px-6">
      {/* 헤더 */}
      <div className="space-y-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/questions")}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          목록으로
        </Button>

        {/* 꼬리질문 체인 브레드크럼 */}
        {question.parentChain.length > 0 && (
          <div className="text-muted-foreground flex flex-wrap items-center gap-1 text-xs">
            {question.parentChain.map((p) => (
              <span key={p.id} className="flex items-center gap-1">
                <Link href={`/questions/${p.id}`} className="hover:text-primary underline">
                  {p.title.length > 30 ? p.title.slice(0, 30) + "..." : p.title}
                </Link>
                <ChevronRight className="h-3 w-3" />
              </span>
            ))}
            <span className="text-foreground font-medium">현재 질문</span>
          </div>
        )}

        <div className="space-y-2">
          <h1 className="text-xl font-bold">{question.title}</h1>
          {question.description && (
            <p className="text-muted-foreground text-sm">{question.description}</p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Badge className={difficultyColors[question.difficulty]}>
              {difficultyLabels[question.difficulty]}
            </Badge>
            {question.categories.map((cat) => (
              <Badge key={cat.id} variant="secondary">
                {cat.name}
              </Badge>
            ))}
            {question.chainDepth > 0 && (
              <Badge variant="outline">꼬리질문 #{question.chainDepth}</Badge>
            )}
          </div>
        </div>
      </div>

      {/* 참고자료 버튼 */}
      {question.referenceContent && (
        <Button variant="outline" size="sm" onClick={() => setShowReference(!showReference)}>
          <FileText className="mr-1 h-4 w-4" />
          {showReference ? "참고자료 닫기" : "참고자료 보기"}
        </Button>
      )}

      {/* 참고자료 패널 */}
      {showReference && question.referenceContent && (
        <Card>
          <CardContent className="p-4">
            <MarkdownContent>{question.referenceContent}</MarkdownContent>
          </CardContent>
        </Card>
      )}

      {/* 코드 스니펫 */}
      {question.codeSnippet && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">코드</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted overflow-x-auto rounded-md p-4 text-sm">
              <code>{question.codeSnippet}</code>
            </pre>
          </CardContent>
        </Card>
      )}

      {/* 답변 / 평가 / 결과 탭 */}
      <Tabs value={store.step} className="space-y-3">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="answering" onClick={() => store.setStep("answering")}>
            1. 답변
          </TabsTrigger>
          <TabsTrigger value="evaluating" disabled={store.step === "answering"}>
            2. 평가
          </TabsTrigger>
          <TabsTrigger value="result" disabled={store.step !== "result"}>
            3. 결과
          </TabsTrigger>
        </TabsList>

        {/* 1. 답변 작성 */}
        <TabsContent value="answering">
          <Card>
            <CardContent className="space-y-4 p-4">
              <Textarea
                placeholder="면접 답변을 작성하세요..."
                value={store.draftAnswer}
                onChange={(e) => store.setDraftAnswer(e.target.value)}
                rows={16}
                className="min-h-[300px] resize-y font-mono text-sm"
              />
              <div className="flex justify-end">
                <Button
                  onClick={startEvaluation}
                  disabled={!store.draftAnswer.trim() || store.isEvaluating}
                >
                  {store.isEvaluating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  평가 시작
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 2. 평가 중 (스트리밍) */}
        <TabsContent value="evaluating">
          <Card>
            <CardContent className="p-4">
              {store.isEvaluating && (
                <div className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  면접관이 답변을 평가하고 있습니다...
                </div>
              )}
              {store.streamingText && (
                <div className="prose dark:prose-invert max-w-none">
                  <MarkdownContent>{store.streamingText}</MarkdownContent>
                </div>
              )}
              {store.evalError && (
                <div className="mt-4 text-sm text-red-500">{store.evalError}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 3. 결과 */}
        <TabsContent value="result">
          <Card>
            <CardContent className="space-y-4 p-4">
              {/* 점수 표시 */}
              {store.parsedScore != null && (
                <div className="flex items-center gap-3">
                  <div
                    className={`rounded-full px-4 py-2 text-2xl font-bold ${
                      store.parsedScore >= passScore
                        ? "bg-green-100 text-green-800"
                        : store.parsedScore >= passScore - 15
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {store.parsedScore}점
                  </div>
                  <Badge
                    variant={store.parsedScore >= passScore ? "default" : "destructive"}
                    className="text-sm"
                  >
                    {store.parsedScore >= passScore ? "PASS" : "RETRY"}
                  </Badge>
                </div>
              )}

              {/* 평가 결과 마크다운 */}
              {store.evalResult && (
                <div className="prose dark:prose-invert max-w-none">
                  <MarkdownContent>{store.evalResult}</MarkdownContent>
                </div>
              )}

              {/* 액션 버튼: 꼬리질문 + 재시도 항상 둘 다 표시 */}
              <div className="flex gap-3 border-t pt-4">
                <Button onClick={generateFollowUp} disabled={store.isGeneratingFollowUp}>
                  {store.isGeneratingFollowUp ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <MessageCircleQuestion className="mr-2 h-4 w-4" />
                  )}
                  꼬리질문 받기
                </Button>
                <Button variant="outline" onClick={() => store.resetForRetry()}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  재시도
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 이전 시도 히스토리 */}
      {question.attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">답변 히스토리</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {question.attempts.map((attempt, i) => (
                <AttemptAccordion key={attempt.id} attempt={attempt} index={i} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AttemptAccordion({
  attempt,
  index,
}: {
  attempt: import("@/lib/queries/use-questions").AttemptData;
  index: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-border rounded-md border">
      <button
        onClick={() => setOpen(!open)}
        className="hover:bg-accent/50 flex w-full cursor-pointer items-center justify-between px-3 py-2.5 text-sm transition-colors"
      >
        <span className="font-medium">시도 #{index + 1}</span>
        <div className="flex items-center gap-2">
          {attempt.score != null && (
            <Badge variant={attempt.passed ? "default" : "outline"} className="text-xs">
              {attempt.score}점
            </Badge>
          )}
          <span className="text-muted-foreground text-xs">
            {new Date(attempt.createdAt).toLocaleDateString("ko-KR")}
          </span>
          <ChevronRight
            className={`text-muted-foreground h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="space-y-4 border-t px-3 py-3">
          {/* 내 답변 */}
          <div>
            <p className="text-muted-foreground mb-1 text-xs font-medium">내 답변</p>
            <div className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
              {attempt.answerText}
            </div>
          </div>

          {/* AI 평가 */}
          {attempt.evalResult && (
            <div>
              <p className="text-muted-foreground mb-1 text-xs font-medium">평가 결과</p>
              <div className="prose dark:prose-invert max-w-none text-sm">
                <MarkdownContent>{attempt.evalResult}</MarkdownContent>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
