"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillBarChart } from "./skill-bar-chart";
import { GapAnalysis } from "./gap-analysis";

interface TrendData {
  currentWeek: string;
  topSkills: Array<{ skill_name: string; mention_count: number }>;
  byWeek: Record<string, Array<{ skill_name: string; mention_count: number }>>;
}

export function JdClient() {
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetch("/api/jd/trends")
      .then((r) => r.json())
      .then(setTrends)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/cron/wanted");
      const data = (await res.json()) as { added: number; skillsTracked: number };
      toast.success(`JD ${data.added}개 수집, 스킬 ${data.skillsTracked}개 트래킹됨`);
      // 새로고침
      const updated = await fetch("/api/jd/trends").then((r) => r.json());
      setTrends(updated as TrendData);
    } catch {
      toast.error("JD 수집에 실패했습니다.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 상단 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground text-sm">원티드 프론트엔드 포지션 기준</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="gap-2"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
          JD 수집
        </Button>
      </div>

      <Tabs defaultValue="trends">
        <TabsList>
          <TabsTrigger value="trends">스킬 트렌드</TabsTrigger>
          <TabsTrigger value="gap">갭 분석</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="mt-4 space-y-4">
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    이번 주 Top 스킬 ({trends?.currentWeek})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SkillBarChart data={trends?.topSkills ?? []} />
                </CardContent>
              </Card>

              {/* 지난 주차 비교 */}
              {trends && Object.keys(trends.byWeek).length > 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">주차별 변화</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(trends.byWeek)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .slice(0, 4)
                      .map(([week, skills]) => (
                        <div key={week}>
                          <p className="text-muted-foreground mb-2 text-xs font-medium">{week}</p>
                          <SkillBarChart
                            data={skills
                              .sort((a, b) => b.mention_count - a.mention_count)
                              .slice(0, 8)}
                          />
                        </div>
                      ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="gap" className="mt-4">
          <GapAnalysis topSkills={trends?.topSkills ?? []} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
