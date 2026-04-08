import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "./keys";
import type { JdInsight } from "@/lib/wanted/jd-analyzer";

export interface TrendData {
  latestDate: string | null;
  topSkills: Array<{ skill_name: string; mention_count: number }>;
  byDate: Record<string, Array<{ skill_name: string; mention_count: number }>>;
}

export function useJdTrends() {
  return useQuery({
    queryKey: queryKeys.jd.trends,
    queryFn: async (): Promise<TrendData> => {
      const res = await fetch("/api/jd/trends");
      if (!res.ok) throw new Error("Failed to fetch JD trends");
      return res.json();
    },
  });
}

export function useJdInsights() {
  return useQuery({
    queryKey: queryKeys.jd.insights,
    queryFn: async (): Promise<JdInsight | null> => {
      const res = await fetch("/api/jd/insights");
      if (!res.ok) return null;
      const data = await res.json();
      return data.insight ?? null;
    },
  });
}
