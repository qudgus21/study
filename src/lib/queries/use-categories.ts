import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";

export interface CategoryData {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  created_at: string;
}

export interface MissionData {
  id: string;
  title: string;
  mission_type: "concept" | "discussion" | "code";
  status: string;
  attempt_count: number;
  last_score: number | null;
}

export function useCategories() {
  return useQuery({
    queryKey: queryKeys.categories.all,
    queryFn: async (): Promise<CategoryData[]> => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      const data = await res.json();
      return data.items;
    },
  });
}

export function useCategoryDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.categories.detail(id),
    queryFn: async () => {
      const res = await fetch(`/api/categories/${id}`);
      if (!res.ok) throw new Error("Failed to fetch category detail");
      return res.json();
    },
    enabled: !!id,
  });
}

export function useCategoryMissions(categoryId: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.categories.questions(categoryId),
    queryFn: async (): Promise<MissionData[]> => {
      const res = await fetch(`/api/categories/${categoryId}/missions`);
      if (!res.ok) throw new Error("Failed to fetch missions");
      const data = await res.json();
      return data.missions;
    },
    enabled,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (form: { name: string; description: string }) => {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create category");
      }
      return res.json() as Promise<CategoryData>;
    },
    onMutate: async (form) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.all });
      const previous = queryClient.getQueryData<CategoryData[]>(queryKeys.categories.all);
      const optimistic: CategoryData = {
        id: `temp-${Date.now()}`,
        name: form.name,
        description: form.description || null,
        source_type: "manual",
        created_at: new Date().toISOString(),
      };
      queryClient.setQueryData<CategoryData[]>(queryKeys.categories.all, (old) =>
        old ? [optimistic, ...old] : [optimistic],
      );
      return { previous };
    },
    onError: (_err, _form, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categories.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete category");
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.categories.all });
      const previous = queryClient.getQueryData<CategoryData[]>(queryKeys.categories.all);
      queryClient.setQueryData<CategoryData[]>(queryKeys.categories.all, (old) =>
        old?.filter((c) => c.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.categories.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}

export function useDeleteMission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ missionId }: { missionId: string; categoryId: string }) => {
      const res = await fetch(`/api/missions/${missionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete mission");
    },
    onMutate: async ({ missionId, categoryId }) => {
      const key = queryKeys.categories.questions(categoryId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<MissionData[]>(key);
      queryClient.setQueryData<MissionData[]>(key, (old) => old?.filter((m) => m.id !== missionId));
      return { previous, categoryId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.categories.questions(context.categoryId),
          context.previous,
        );
      }
    },
    onSettled: (_data, _err, { categoryId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.questions(categoryId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    },
  });
}
