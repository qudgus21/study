import { useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import type { MissionType } from "@/lib/agents";

export interface MissionCardData {
  id: string;
  title: string;
  missionType: MissionType;
  status: "pending" | "in_progress" | "passed" | "failed";
  categoryName: string;
  attemptCount: number;
  lastScore: number | null;
}

export interface MissionDetail {
  id: string;
  missionType: MissionType;
  status: string;
  title: string;
  description: string | null;
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

export function useMissions() {
  return useQuery({
    queryKey: queryKeys.missions.all,
    queryFn: async (): Promise<MissionCardData[]> => {
      const res = await fetch("/api/missions");
      if (!res.ok) throw new Error("Failed to fetch missions");
      const data = await res.json();

      return (data as Array<Record<string, unknown>>).map((m) => ({
        id: m.id as string,
        title: (m.title as string) ?? "제목 없음",
        missionType: m.mission_type as MissionType,
        status: m.status as MissionCardData["status"],
        categoryName: m.category_name as string,
        attemptCount: (m.attempts as Array<unknown>)?.length ?? 0,
        lastScore:
          (m.attempts as Array<Record<string, unknown>>)?.length > 0
            ? (((m.attempts as Array<Record<string, unknown>>)[
                (m.attempts as Array<unknown>).length - 1
              ]?.score as number | null) ?? null)
            : null,
      }));
    },
  });
}

export function useMission(missionId: string) {
  return useQuery({
    queryKey: queryKeys.missions.detail(missionId),
    queryFn: async (): Promise<MissionDetail> => {
      const res = await fetch(`/api/missions/${missionId}`);
      if (!res.ok) throw new Error("Failed to fetch mission");
      const data = await res.json();

      return {
        id: data.id,
        missionType: data.mission_type as MissionType,
        status: data.status,
        title: data.title ?? data.topic_title ?? "",
        description: data.description ?? data.topic_description ?? null,
        codeSnippet: data.code_snippet ?? null,
        categoryName: data.category_name ?? "기타",
        attempts: (data.attempts ?? []).map((a: Record<string, unknown>) => ({
          id: a.id,
          score: a.score ?? null,
          passed: a.passed ?? false,
          feedbackSummary: a.feedback_summary ?? null,
          createdAt: a.created_at ?? "",
        })),
      };
    },
    enabled: !!missionId,
  });
}

export function useInvalidateMission() {
  const queryClient = useQueryClient();
  return (missionId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.missions.detail(missionId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.missions.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
  };
}
