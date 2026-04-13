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
  lastScore: number | null;
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
            lastScore: getLastScore(q.attempts as Record<string, unknown>[] | null),
            createdAt: q.created_at as string,
          }) satisfies QuestionCardData,
      );
    },
  });
}

function getLastScore(attempts: Record<string, unknown>[] | null): number | null {
  if (!attempts || attempts.length === 0) return null;
  const sorted = [...attempts].sort(
    (a, b) =>
      new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime(),
  );
  return (sorted[0].score as number) ?? null;
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

// === 질문 무효화 (상세 페이지 새로고침) ===
export function useInvalidateQuestion() {
  const queryClient = useQueryClient();
  return (questionId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.questions.detail(questionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
  };
}
