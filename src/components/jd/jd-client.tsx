"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkillBarChart } from "./skill-bar-chart";
import { GapAnalysis } from "./gap-analysis";

interface TrendData {
  latestDate: string | null;
  topSkills: Array<{ skill_name: string; mention_count: number }>;
  byDate: Record<string, Array<{ skill_name: string; mention_count: number }>>;
}

export function JdClient() {
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jd/trends")
      .then((r) => r.json())
      .then(setTrends)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">원티드 프론트엔드 5년+ 포지션 기준</p>

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
                    Top 스킬 ({trends?.latestDate ?? "수집 필요"})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SkillBarChart data={trends?.topSkills ?? []} />
                </CardContent>
              </Card>

              {trends && Object.keys(trends.byDate).length > 1 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">수집일별 변화</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {Object.entries(trends.byDate)
                      .sort(([a], [b]) => b.localeCompare(a))
                      .slice(0, 4)
                      .map(([date, skills]) => (
                        <div key={date}>
                          <p className="text-muted-foreground mb-2 text-xs font-medium">{date}</p>
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
