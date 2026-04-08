"use client";

import { useEffect, useState } from "react";
import {
  Users,
  ClipboardList,
  Award,
  Star,
  Heart,
  Building2,
  MessageSquareQuote,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { JdInsight } from "@/lib/wanted/jd-analyzer";

interface InsightResponse {
  insight: JdInsight | null;
}

interface CountItem {
  name: string;
  count: number;
  description?: string;
  examples?: string[];
  companies?: string[];
}

function RankedList({
  items,
  totalJds,
  showExamples,
}: {
  items: CountItem[];
  totalJds: number;
  showExamples?: boolean;
}) {
  if (items.length === 0) {
    return <p className="text-muted-foreground text-xs">데이터 없음</p>;
  }

  const maxCount = items[0]?.count ?? 1;

  return (
    <div className="space-y-2.5">
      {items.map((item, i) => {
        const pct = Math.round((item.count / totalJds) * 100);
        const barPct = Math.round((item.count / maxCount) * 100);
        return (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-5 text-right text-xs tabular-nums">
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-medium">{item.name}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {item.count}건 ({pct}%)
              </span>
            </div>
            <div className="ml-7">
              <div className="bg-muted h-1.5 rounded-full">
                <div
                  className="h-1.5 rounded-full bg-indigo-500 transition-all duration-500"
                  style={{ width: `${Math.max(barPct, 3)}%` }}
                />
              </div>
              {item.description && (
                <p className="text-foreground/60 mt-1 text-sm">{item.description}</p>
              )}
              {showExamples && item.examples && item.examples.length > 0 && (
                <div className="mt-1 space-y-0.5">
                  {item.examples.map((ex, j) => (
                    <p key={j} className="text-foreground/60 text-sm">
                      &ldquo;{ex}&rdquo;
                    </p>
                  ))}
                </div>
              )}
              {item.companies && item.companies.length > 0 && (
                <p className="text-muted-foreground mt-1 text-[10px]">
                  {item.companies.join(", ")}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const SECTIONS = [
  {
    key: "competencies" as const,
    title: "역량 / 소프트스킬",
    icon: Users,
    showExamples: true,
  },
  {
    key: "responsibilities" as const,
    title: "주요 업무 패턴",
    icon: ClipboardList,
    showExamples: false,
  },
  {
    key: "qualifications" as const,
    title: "자격요건 (기술 외)",
    icon: Award,
    showExamples: false,
  },
  {
    key: "preferred" as const,
    title: "우대사항 패턴",
    icon: Star,
    showExamples: false,
  },
  {
    key: "culture" as const,
    title: "팀 / 조직 문화",
    icon: Heart,
    showExamples: false,
  },
  {
    key: "domains" as const,
    title: "도메인 / 산업 분포",
    icon: Building2,
    showExamples: false,
  },
] as const;

export function JdInsights() {
  const [data, setData] = useState<JdInsight | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jd/insights")
      .then((r) => (r.ok ? r.json() : null))
      .then((res: InsightResponse | null) => res?.insight && setData(res.insight))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton className="h-64 w-full" />;

  if (!data) {
    return (
      <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed text-sm">
        JD 수집 시 AI 인사이트가 자동 생성됩니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-xs">
        {data.collected_date} 수집 · JD {data.total_jds}개 분석
      </p>

      {/* 종합 인사이트 */}
      <Card className="border-indigo-500/20 bg-indigo-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageSquareQuote className="h-4 w-4 text-indigo-500" />
            종합 인사이트
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{data.summary}</p>
        </CardContent>
      </Card>

      {/* 각 섹션 */}
      {SECTIONS.map((section) => {
        const items = data[section.key] as CountItem[];
        if (!items || items.length === 0) return null;
        const Icon = section.icon;
        return (
          <Card key={section.key}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Icon className="h-4 w-4" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RankedList
                items={items}
                totalJds={data.total_jds}
                showExamples={section.showExamples}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
