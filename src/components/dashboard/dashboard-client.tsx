"use client";

import { useEffect, useState } from "react";
import { Flame, Target, TrendingUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "./progress-ring";
import { RadarChart } from "./radar-chart";

type MissionType = "concept" | "discussion" | "code";

interface DashboardData {
  week: {
    id: string;
    week_start: string;
    carried_over_count: number;
  };
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
}

const typeConfig: Record<MissionType, { label: string; color: string }> = {
  concept: { label: "개념", color: "#3b82f6" },
  discussion: { label: "토론", color: "#a855f7" },
  code: { label: "코드", color: "#22c55e" },
};

function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);

  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${fmt(start)} ~ ${fmt(end)}`;
}

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground text-sm">데이터를 불러올 수 없습니다.</p>;
  }

  const overallRate =
    data.totalMissions > 0 ? Math.round((data.completedMissions / data.totalMissions) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 주간 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">이번 주</p>
          <p className="text-lg font-bold">{formatWeekRange(data.week.week_start)}</p>
        </div>
        <div className="flex items-center gap-2">
          {data.week.carried_over_count > 0 && (
            <Badge variant="secondary">이월 {data.week.carried_over_count}개</Badge>
          )}
          <Badge variant="outline">{overallRate}% 완료</Badge>
        </div>
      </div>

      {/* 진행률 링 + 스트릭 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-around">
            {(["concept", "discussion", "code"] as MissionType[]).map((type) => (
              <ProgressRing
                key={type}
                passed={data.progress[type].passed}
                total={data.progress[type].total}
                label={typeConfig[type].label}
                color={typeConfig[type].color}
              />
            ))}
            {/* 스트릭 */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-4 border-orange-400">
                <Flame className="h-6 w-6 text-orange-400" />
                <span className="text-lg leading-none font-bold">{data.streak}</span>
                <span className="text-muted-foreground text-xs">일</span>
              </div>
              <span className="text-muted-foreground text-xs font-medium">스트릭</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 카테고리 레이더 차트 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <TrendingUp className="h-4 w-4" />
            카테고리별 역량
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadarChart data={data.categoryStats} />
        </CardContent>
      </Card>

      {/* 약한 영역 추천 */}
      {data.weakAreas.length > 0 && (
        <Card className="border-yellow-500/20 bg-yellow-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              보강이 필요한 영역
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.weakAreas.map((area) => (
              <div key={area.skill_name} className="flex items-center justify-between">
                <span className="text-sm">{area.skill_name}</span>
                <div className="flex items-center gap-2">
                  <div className="bg-muted h-1.5 w-24 rounded-full">
                    <div
                      className="h-1.5 rounded-full bg-yellow-500"
                      style={{ width: `${area.confidence_level}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-8 text-right text-xs">
                    {area.confidence_level}%
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 카테고리 통계가 없을 때 안내 */}
      {data.categoryStats.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Target className="text-muted-foreground mx-auto mb-2 h-8 w-8" />
            <p className="text-muted-foreground text-sm">
              미션을 완료하면 카테고리별 역량 차트가 표시됩니다.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
