import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./keys";

type MissionType = "concept" | "discussion" | "code";

export interface DashboardData {
  progress: Record<MissionType, { passed: number; total: number }>;
  streak: number;
  categoryStats: Array<{
    skill_name: string;
    total_missions: number;
    passed_missions: number;
    confidence_level: number;
  }>;
  weakAreas: Array<{
    skill_name: string;
    confidence_level: number;
  }>;
  totalMissions: number;
  completedMissions: number;
  totalArticles: number;
  readArticles: number;
  totalCategories: number;
}

export function useDashboard() {
  return useQuery({
    queryKey: queryKeys.dashboard,
    queryFn: async (): Promise<DashboardData> => {
      const res = await fetch("/api/dashboard");
      if (!res.ok) throw new Error("Failed to fetch dashboard");
      return res.json();
    },
  });
}
