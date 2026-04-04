"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface WeekStats {
  total: number;
  passed: number;
  concept: { total: number; passed: number };
  discussion: { total: number; passed: number };
  code: { total: number; passed: number };
}

interface HistoryWeek {
  id: string;
  week_start: string;
  carried_over_count: number;
  stats: WeekStats;
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart);
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6);
  const fmt = (d: Date) => `${d.getMonth() + 1}/${d.getDate()}`;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ~ ${fmt(end)}`;
}

function StatBar({ passed, total, color }: { passed: number; total: number; color: string }) {
  const pct = total > 0 ? (passed / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="bg-muted h-1.5 flex-1 rounded-full">
        <div
          className="h-1.5 rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-muted-foreground w-10 text-right text-xs">
        {passed}/{total}
      </span>
    </div>
  );
}

function WeekCard({ week }: { week: HistoryWeek }) {
  const [expanded, setExpanded] = useState(false);
  const passRate =
    week.stats.total > 0 ? Math.round((week.stats.passed / week.stats.total) * 100) : 0;
  const allPassed = week.stats.passed === week.stats.total && week.stats.total > 0;

  return (
    <Card>
      <CardHeader
        className="cursor-pointer pb-2 select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {allPassed ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <XCircle className="text-muted-foreground h-4 w-4" />
            )}
            <CardTitle className="text-sm font-medium">
              {formatWeekLabel(week.week_start)}
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={allPassed ? "default" : "secondary"}>{passRate}%</Badge>
            {expanded ? (
              <ChevronUp className="text-muted-foreground h-4 w-4" />
            ) : (
              <ChevronDown className="text-muted-foreground h-4 w-4" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 pt-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-blue-600">개념</span>
            </div>
            <StatBar
              passed={week.stats.concept.passed}
              total={week.stats.concept.total}
              color="#3b82f6"
            />

            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-purple-600">토론</span>
            </div>
            <StatBar
              passed={week.stats.discussion.passed}
              total={week.stats.discussion.total}
              color="#a855f7"
            />

            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-green-600">코드</span>
            </div>
            <StatBar
              passed={week.stats.code.passed}
              total={week.stats.code.total}
              color="#22c55e"
            />
          </div>

          {week.carried_over_count > 0 && (
            <p className="text-muted-foreground text-xs">
              이월 미션 {week.carried_over_count}개 포함
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function HistoryClient() {
  const [history, setHistory] = useState<HistoryWeek[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/history")
      .then((r) => r.json())
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm">아직 지난 주차 기록이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((week) => (
        <WeekCard key={week.id} week={week} />
      ))}
    </div>
  );
}
