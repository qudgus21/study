"use client";

import { Flame, Target, TrendingUp, BookOpen, FolderOpen, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RadarChart } from "./radar-chart";
import { useDashboard } from "@/lib/queries/use-dashboard";

type MissionType = "concept" | "discussion" | "code";

const typeConfig: Record<MissionType, { label: string; color: string; bg: string }> = {
  concept: { label: "개념", color: "text-blue-500", bg: "bg-blue-500/10" },
  discussion: { label: "토론", color: "text-violet-500", bg: "bg-violet-500/10" },
  code: { label: "코드", color: "text-emerald-500", bg: "bg-emerald-500/10" },
};

export function DashboardClient() {
  const { data, isLoading } = useDashboard();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-muted-foreground text-sm">데이터를 불러올 수 없습니다.</p>;
  }

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<BookOpen className="h-4 w-4 text-blue-500" />}
          label="읽은 아티클"
          value={data.readArticles}
          accent="blue"
        />
        <StatCard
          icon={<FolderOpen className="h-4 w-4 text-violet-500" />}
          label="카테고리"
          value={data.totalCategories}
          accent="violet"
        />
        <StatCard
          icon={<Flame className="h-4 w-4 text-orange-500" />}
          label="연속 학습"
          value={data.streak}
          sub="일"
          accent="orange"
        />
      </div>

      {/* 완료 미션 (카테고리별) */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-4 w-4" />
            완료 미션
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3">
            {(["concept", "discussion", "code"] as MissionType[]).map((type) => (
              <div
                key={type}
                className={`flex flex-col items-center rounded-lg ${typeConfig[type].bg} py-3`}
              >
                <span className={`text-2xl font-bold ${typeConfig[type].color}`}>
                  {data.progress[type].passed}
                </span>
                <span className="text-muted-foreground text-xs">{typeConfig[type].label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 카테고리 레이더 차트 */}
      {data.categoryStats.length > 0 ? (
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
      ) : (
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

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  accent: string;
}) {
  const bgMap: Record<string, string> = {
    blue: "bg-blue-500/10",
    violet: "bg-violet-500/10",
    orange: "bg-orange-500/10",
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="flex flex-col items-center gap-1 p-4">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bgMap[accent]}`}>
          {icon}
        </div>
        <div className="flex items-baseline gap-0.5">
          <span className="text-2xl font-bold tracking-tight">{value}</span>
          {sub && <span className="text-muted-foreground text-sm">{sub}</span>}
        </div>
        <p className="text-muted-foreground text-xs">{label}</p>
      </CardContent>
    </Card>
  );
}
