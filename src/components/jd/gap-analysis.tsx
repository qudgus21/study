"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, XCircle, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface GapItem {
  skill_name: string;
  market_count: number;
  confidence_level: number;
  status: "green" | "yellow" | "red";
}

interface GapData {
  gaps: GapItem[];
  summary: { green: number; yellow: number; red: number };
  weekStart: string;
}

interface GapAnalysisProps {
  topSkills: Array<{ skill_name: string; mention_count: number }>;
}

const statusConfig = {
  green: {
    icon: CheckCircle2,
    label: "강점",
    color: "text-green-600",
    bg: "bg-green-500",
    badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  yellow: {
    icon: AlertCircle,
    label: "보통",
    color: "text-yellow-600",
    bg: "bg-yellow-500",
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  red: {
    icon: XCircle,
    label: "갭",
    color: "text-red-600",
    bg: "bg-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

export function GapAnalysis({ topSkills }: GapAnalysisProps) {
  const [data, setData] = useState<GapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch("/api/jd/gap")
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [topSkills]);

  async function handleGenerateTopics() {
    setGenerating(true);
    try {
      const res = await fetch("/api/cron/generate-topics");
      const result = (await res.json()) as { created: number; skills: string[] };
      if (result.created > 0) {
        toast.success(`${result.created}개 토픽 자동 생성됨: ${result.skills.join(", ")}`);
      } else {
        toast.info("생성할 갭 토픽이 없습니다. (이미 생성됐거나 RED 스킬 없음)");
      }
    } catch {
      toast.error("토픽 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;

  if (!data || data.gaps.length === 0) {
    return (
      <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed text-sm">
        JD 수집 후 갭 분석을 확인할 수 있습니다.
      </div>
    );
  }

  const byStatus = {
    red: data.gaps.filter((g) => g.status === "red"),
    yellow: data.gaps.filter((g) => g.status === "yellow"),
    green: data.gaps.filter((g) => g.status === "green"),
  };

  return (
    <div className="space-y-4">
      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3">
        {(["green", "yellow", "red"] as const).map((s) => {
          const cfg = statusConfig[s];
          return (
            <div key={s} className="rounded-lg border p-3 text-center">
              <div className={`text-2xl font-bold ${cfg.color}`}>{data.summary[s]}</div>
              <div className="text-muted-foreground text-xs">{cfg.label}</div>
            </div>
          );
        })}
      </div>

      {/* 갭 목록 */}
      <div className="space-y-2">
        {(["red", "yellow", "green"] as const).map((status) =>
          byStatus[status].map((item) => {
            const cfg = statusConfig[status];
            const Icon = cfg.icon;
            return (
              <div key={item.skill_name} className="flex items-center gap-3 rounded-lg border p-3">
                <Icon className={`h-4 w-4 shrink-0 ${cfg.color}`} />
                <span className="flex-1 text-sm font-medium">{item.skill_name}</span>
                <span className="text-muted-foreground text-xs">JD {item.market_count}개</span>
                {/* 역량 바 */}
                <div className="flex items-center gap-1">
                  <div className="bg-muted h-1.5 w-20 rounded-full">
                    <div
                      className={`h-1.5 rounded-full ${cfg.bg}`}
                      style={{ width: `${item.confidence_level}%` }}
                    />
                  </div>
                  <span className="text-muted-foreground w-8 text-right text-xs">
                    {item.confidence_level}%
                  </span>
                </div>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
            );
          }),
        )}
      </div>

      {/* 갭 토픽 자동 생성 */}
      {data.summary.red > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-600">
              RED 갭 스킬 {data.summary.red}개 발견
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-xs">
              시장에서 요구하지만 역량이 부족한 스킬을 토픽으로 자동 생성합니다.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateTopics}
              disabled={generating}
              className="gap-2"
            >
              <Wand2 className="h-3.5 w-3.5" />
              {generating ? "생성 중..." : "갭 토픽 자동 생성"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
