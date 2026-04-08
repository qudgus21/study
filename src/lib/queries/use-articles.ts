import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export interface ArticleData {
  id: string;
  title: string;
  url: string;
  source: string;
  summary: string;
  published_at: string;
  is_read: boolean;
  is_bookmarked: boolean;
  topic_generated?: boolean;
}

export function useArticles() {
  return useQuery({
    queryKey: queryKeys.articles,
    queryFn: async (): Promise<ArticleData[]> => {
      const res = await fetch("/api/articles");
      if (!res.ok) throw new Error("Failed to fetch articles");
      const data = await res.json();
      return data.items;
    },
  });
}

export function useUpdateArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, changes }: { id: string; changes: Partial<ArticleData> }) => {
      const res = await fetch(`/api/articles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error("Failed to update article");
    },
    onMutate: async ({ id, changes }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.articles });
      const previous = queryClient.getQueryData<ArticleData[]>(queryKeys.articles);
      queryClient.setQueryData<ArticleData[]>(queryKeys.articles, (old) =>
        old?.map((a) => (a.id === id ? { ...a, ...changes } : a)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.articles, context.previous);
      }
    },
  });
}

export function useDeleteArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/articles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete article");
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.articles });
      const previous = queryClient.getQueryData<ArticleData[]>(queryKeys.articles);
      queryClient.setQueryData<ArticleData[]>(queryKeys.articles, (old) =>
        old?.filter((a) => a.id !== id),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.articles, context.previous);
      }
    },
  });
}

export function useGenerateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (articleId: string) => {
      const res = await fetch(`/api/articles/${articleId}/generate-category`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Failed to generate category");
    },
    onSuccess: (_data, articleId) => {
      queryClient.setQueryData<ArticleData[]>(queryKeys.articles, (old) =>
        old?.map((a) => (a.id === articleId ? { ...a, topic_generated: true } : a)),
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
    },
  });
}
