"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MissionCard, type MissionCardData } from "@/components/missions/mission-card";
import { Skeleton } from "@/components/ui/skeleton";

type FilterType = "all" | "concept" | "discussion" | "code";

export function MissionListClient() {
  const [missions, setMissions] = useState<MissionCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");

  useEffect(() => {
    async function fetchMissions() {
      try {
        const res = await fetch("/api/missions");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        const mapped: MissionCardData[] = (data as Record<string, unknown>[]).map((m) => ({
          id: m.id,
          title: m.topic_title ?? "제목 없음",
          missionType: m.mission_type,
          status: m.status,
          categoryName: m.category_name,
          attemptCount: m.attempts?.length ?? 0,
          lastScore:
            m.attempts?.length > 0 ? (m.attempts[m.attempts.length - 1]?.score ?? null) : null,
          isCarriedOver: m.is_carried_over,
        }));

        setMissions(mapped);
      } catch (error) {
        console.error("Failed to fetch missions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchMissions();
  }, []);

  const filtered = filter === "all" ? missions : missions.filter((m) => m.missionType === filter);

  const stats = {
    concept: missions.filter((m) => m.missionType === "concept" && m.status === "passed").length,
    discussion: missions.filter((m) => m.missionType === "discussion" && m.status === "passed")
      .length,
    code: missions.filter((m) => m.missionType === "code" && m.status === "passed").length,
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 진행 요약 */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.concept}/5</div>
          <div className="text-muted-foreground text-xs">개념</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.discussion}/5</div>
          <div className="text-muted-foreground text-xs">토론</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.code}/5</div>
          <div className="text-muted-foreground text-xs">코드</div>
        </div>
      </div>

      {/* 필터 탭 */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
        <TabsList>
          <TabsTrigger value="all">전체 ({missions.length})</TabsTrigger>
          <TabsTrigger value="concept">개념</TabsTrigger>
          <TabsTrigger value="discussion">토론</TabsTrigger>
          <TabsTrigger value="code">코드</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="text-muted-foreground py-12 text-center">
              <p>이번 주 미션이 없습니다.</p>
              <p className="text-xs">토픽 생성 후 미션이 자동으로 배정됩니다.</p>
            </div>
          ) : (
            filtered.map((mission) => <MissionCard key={mission.id} mission={mission} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
