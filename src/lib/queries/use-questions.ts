import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import type { QuestionDifficulty, QuestionSource } from "@/lib/agents";

export interface QuestionCategory {
  id: string;
  name: string;
}

export interface QuestionCardData {
  id: string;
  title: string;
  description: string | null;
  difficulty: QuestionDifficulty;
  sourceType: QuestionSource;
  status: "pending" | "in_progress" | "passed";
  categories: QuestionCategory[];
  parentQuestionId: string | null;
  chainDepth: number;
  attemptCount: number;
  passedCount: number;
  bestScore: number | null;
  isConfirmed: boolean;
  createdAt: string;
}

export interface AttemptData {
  id: string;
  answerText: string;
  score: number | null;
  passed: boolean;
  feedbackSummary: string | null;
  evalResult: string | null;
  createdAt: string;
}

export interface QuestionDetail {
  id: string;
  title: string;
  description: string | null;
  codeSnippet: string | null;
  referenceContent: string | null;
  difficulty: QuestionDifficulty;
  sourceType: QuestionSource;
  sourceRef: string | null;
  parentQuestionId: string | null;
  chainDepth: number;
  status: "pending" | "in_progress" | "passed";
  confirmedAttemptId: string | null;
  categories: QuestionCategory[];
  attempts: AttemptData[];
  parentChain: { id: string; title: string }[];
  createdAt: string;
  completedAt: string | null;
}

// === 질문 목록 ===
export function useQuestions() {
  return useQuery({
    queryKey: queryKeys.questions.all,
    queryFn: async (): Promise<QuestionCardData[]> => {
      const res = await fetch("/api/questions");
      if (!res.ok) throw new Error("Failed to fetch questions");
      const data = await res.json();
      return data.map(
        (q: Record<string, unknown>) =>
          ({
            id: q.id as string,
            title: q.title as string,
            description: q.description as string | null,
            difficulty: q.difficulty as QuestionDifficulty,
            sourceType: q.source_type as QuestionSource,
            status: q.status as "pending" | "in_progress" | "passed",
            categories: (q.categories as QuestionCategory[]) ?? [],
            parentQuestionId: q.parent_question_id as string | null,
            chainDepth: (q.chain_depth as number) ?? 0,
            attemptCount: ((q.attempts as unknown[]) ?? []).length,
            passedCount: getPassedCount(q.attempts as Record<string, unknown>[] | null),
            bestScore: getBestScore(q.attempts as Record<string, unknown>[] | null),
            isConfirmed: q.confirmed_attempt_id != null,
            createdAt: q.created_at as string,
          }) satisfies QuestionCardData,
      );
    },
  });
}

function getPassedCount(attempts: Record<string, unknown>[] | null): number {
  if (!attempts) return 0;
  return attempts.filter((a) => a.passed === true).length;
}

function getBestScore(attempts: Record<string, unknown>[] | null): number | null {
  if (!attempts || attempts.length === 0) return null;
  const scores = attempts
    .map((a) => a.score as number | null)
    .filter((s): s is number => s != null);
  return scores.length > 0 ? Math.max(...scores) : null;
}

// === 질문 상세 ===
export function useQuestion(questionId: string | null) {
  return useQuery({
    queryKey: queryKeys.questions.detail(questionId ?? ""),
    queryFn: async (): Promise<QuestionDetail> => {
      const res = await fetch(`/api/questions/${questionId}`);
      if (!res.ok) throw new Error("Failed to fetch question");
      const q = await res.json();
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        codeSnippet: q.code_snippet,
        referenceContent: q.reference_content,
        difficulty: q.difficulty,
        sourceType: q.source_type,
        sourceRef: q.source_ref,
        parentQuestionId: q.parent_question_id,
        chainDepth: q.chain_depth ?? 0,
        status: q.status,
        confirmedAttemptId: q.confirmed_attempt_id ?? null,
        categories: q.categories ?? [],
        attempts: q.attempts ?? [],
        parentChain: q.parentChain ?? [],
        createdAt: q.created_at,
        completedAt: q.completed_at,
      };
    },
    enabled: !!questionId,
  });
}

// === 질문 삭제 ===
export function useDeleteQuestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (questionId: string) => {
      const res = await fetch(`/api/questions/${questionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete question");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
    },
  });
}

// === 최종 답변 확정 ===
export function useConfirmAttempt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      questionId,
      attemptId,
    }: {
      questionId: string;
      attemptId: string | null;
    }) => {
      const res = await fetch(`/api/questions/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed_attempt_id: attemptId }),
      });
      if (!res.ok) throw new Error("Failed to confirm attempt");
    },
    onSuccess: (_, { questionId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.detail(questionId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
    },
  });
}

// === 질문 무효화 (상세 페이지 새로고침) ===
export function useInvalidateQuestion() {
  const queryClient = useQueryClient();
  return (questionId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.questions.detail(questionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
  };
}
