"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MissionCard } from "@/components/missions/mission-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useMissions } from "@/lib/queries/use-missions";

type FilterType = "all" | "concept" | "discussion" | "code";

export function MissionListClient() {
  const { data: missions = [], isLoading } = useMissions();
  const [filter, setFilter] = useState<FilterType>("all");

  const filtered = filter === "all" ? missions : missions.filter((m) => m.missionType === filter);

  const stats = {
    concept: missions.filter((m) => m.missionType === "concept" && m.status === "passed").length,
    discussion: missions.filter((m) => m.missionType === "discussion" && m.status === "passed")
      .length,
    code: missions.filter((m) => m.missionType === "code" && m.status === "passed").length,
  };

  if (isLoading) {
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
          <div className="text-2xl font-bold text-blue-600">{stats.concept}</div>
          <div className="text-muted-foreground text-xs">개념 통과</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-purple-600">{stats.discussion}</div>
          <div className="text-muted-foreground text-xs">토론 통과</div>
        </div>
        <div className="rounded-lg border p-3 text-center">
          <div className="text-2xl font-bold text-green-600">{stats.code}</div>
          <div className="text-muted-foreground text-xs">코드 통과</div>
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
              <p>미션이 없습니다.</p>
              <p className="text-xs">카테고리에서 미션을 생성해보세요.</p>
            </div>
          ) : (
            filtered.map((mission) => <MissionCard key={mission.id} mission={mission} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
