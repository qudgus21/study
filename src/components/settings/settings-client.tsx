"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Play } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Settings {
  carry_over_limit: number;
  weekly_goal_concept: number;
  weekly_goal_discussion: number;
  weekly_goal_code: number;
  pass_score: number;
}

type CronJob = {
  label: string;
  url: string;
  description: string;
};

const CRON_JOBS: CronJob[] = [
  { label: "RSS 수집", url: "/api/cron/rss", description: "6개 RSS 소스에서 아티클 수집" },
  {
    label: "원티드 JD 수집",
    url: "/api/cron/wanted",
    description: "프론트엔드 JD 20개 수집 및 스킬 집계",
  },
  { label: "GitHub 릴리즈", url: "/api/cron/github", description: "9개 repo 최신 릴리즈 확인" },
  {
    label: "갭 토픽 생성",
    url: "/api/cron/generate-topics",
    description: "RED 갭 스킬 토픽 자동 생성",
  },
  { label: "주간 처리", url: "/api/cron/daily", description: "새 주 생성 및 미완료 미션 이월" },
];

function NumberInput({
  label,
  value,
  onChange,
  min = 1,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <label className="text-sm">{label}</label>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="border-input flex h-7 w-7 items-center justify-center rounded-md border text-sm"
        >
          -
        </button>
        <span className="w-8 text-center text-sm font-medium">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="border-input flex h-7 w-7 items-center justify-center rounded-md border text-sm"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function SettingsClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningCron, setRunningCron] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      toast.success("설정이 저장됐습니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRunCron(job: CronJob) {
    setRunningCron(job.url);
    try {
      const res = await fetch(job.url);
      const data = (await res.json()) as Record<string, unknown>;
      toast.success(`${job.label} 완료: ${JSON.stringify(data).slice(0, 100)}`);
    } catch {
      toast.error(`${job.label} 실패`);
    } finally {
      setRunningCron(null);
    }
  }

  if (loading) return <Skeleton className="h-64 w-full" />;
  if (!settings) return null;

  return (
    <div className="max-w-lg space-y-4">
      {/* 주간 목표 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">주간 목표</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NumberInput
            label="개념 미션 목표"
            value={settings.weekly_goal_concept}
            onChange={(v) => setSettings((s) => (s ? { ...s, weekly_goal_concept: v } : s))}
          />
          <NumberInput
            label="토론 미션 목표"
            value={settings.weekly_goal_discussion}
            onChange={(v) => setSettings((s) => (s ? { ...s, weekly_goal_discussion: v } : s))}
          />
          <NumberInput
            label="코드 미션 목표"
            value={settings.weekly_goal_code}
            onChange={(v) => setSettings((s) => (s ? { ...s, weekly_goal_code: v } : s))}
          />
        </CardContent>
      </Card>

      {/* 시스템 설정 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">시스템</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <NumberInput
            label="이월 상한 (미션 수)"
            value={settings.carry_over_limit}
            onChange={(v) => setSettings((s) => (s ? { ...s, carry_over_limit: v } : s))}
            max={15}
          />
          <NumberInput
            label="통과 기준 점수"
            value={settings.pass_score}
            onChange={(v) => setSettings((s) => (s ? { ...s, pass_score: v } : s))}
            min={50}
            max={100}
          />
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "저장 중..." : "설정 저장"}
      </Button>

      {/* 수동 Cron 트리거 */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">수동 실행</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {CRON_JOBS.map((job) => (
            <div key={job.url} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{job.label}</p>
                <p className="text-muted-foreground text-xs">{job.description}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRunCron(job)}
                disabled={runningCron !== null}
                className="shrink-0 gap-1.5"
              >
                {runningCron === job.url ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
                실행
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
