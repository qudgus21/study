"use client";

import { useState, useRef, useEffect } from "react";
import {
  RefreshCw,
  Play,
  Sparkles,
  Newspaper,
  Briefcase,
  Rss,
  SlidersHorizontal,
  Tag,
  X,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSettings, useSaveSettings, type Settings } from "@/lib/queries/use-settings";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";

const CATEGORY_GENERATORS = [
  {
    key: "ai",
    label: "AI 자율 생성",
    description: "시니어 FE 개발자에게 적합한 학습 카테고리를 AI가 생성",
    icon: Sparkles,
    url: "/api/categories/generate/ai",
  },
  {
    key: "jd",
    label: "JD 기반",
    description: "채용공고 인사이트 + 스킬 트렌드에서 학습 카테고리 생성",
    icon: Briefcase,
    url: "/api/categories/generate/jd",
  },
  {
    key: "article",
    label: "아티클 기반",
    description: "기술 블로그 아티클에서 AI로 학습 카테고리 추출",
    icon: Newspaper,
    url: "/api/categories/generate/article",
  },
] as const;

const DATA_COLLECTORS = [
  {
    key: "rss",
    label: "아티클 수집",
    description: "Korean FE Article, 긱뉴스, 요즘IT, 카카오, 토스, 우아한형제들",
    icon: Rss,
    url: "/api/cron/rss",
  },
  {
    key: "wanted",
    label: "원티드 JD 수집",
    description: "원티드 프론트엔드 5년+ 전체 JD 수집 및 스킬 집계",
    icon: Briefcase,
    url: "/api/cron/wanted",
  },
] as const;

const STORAGE_KEY = "settings_last_run";

function getLastRunMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveLastRun(key: string) {
  const map = getLastRunMap();
  map[key] = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function formatLastRun(iso: string | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "방금 전";
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}시간 전`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function SettingsClient() {
  const { data: serverSettings, isLoading } = useSettings();
  const saveSettings = useSaveSettings();
  const queryClient = useQueryClient();

  // 로컬 편집 상태 (서버 데이터 기반)
  const [localSettings, setLocalSettings] = useState<Settings | null>(null);
  const [categoryCounts, setTopicCounts] = useState({ ai: 5, jd: 5, article: 5 });
  const [generatingType, setGeneratingType] = useState<string | null>(null);
  const [collectingKey, setCollectingKey] = useState<string | null>(null);
  const [lastRunMap, setLastRunMap] = useState<Record<string, string>>({});
  const [rssDays, setRssDays] = useState(1);
  const [showKeywords, setShowKeywords] = useState(false);
  const [newKeyword, setNewKeyword] = useState("");
  const [collectModal, setCollectModal] = useState<{
    open: boolean;
    label: string;
    logs: string[];
    done: boolean;
  }>({ open: false, label: "", logs: [], done: false });
  const keywordInputRef = useRef<HTMLInputElement>(null);
  const composingRef = useRef(false);
  const modalLogsRef = useRef<HTMLDivElement>(null);

  // 서버 데이터가 오면 로컬 상태 초기화
  useEffect(() => {
    if (serverSettings && !localSettings) {
      setLocalSettings(serverSettings);
    }
  }, [serverSettings, localSettings]);

  useEffect(() => {
    setLastRunMap(getLastRunMap());
  }, []);

  useEffect(() => {
    if (modalLogsRef.current) {
      modalLogsRef.current.scrollTop = modalLogsRef.current.scrollHeight;
    }
  }, [collectModal.logs]);

  const settings = localSettings;

  async function handleSave() {
    if (!settings) return;
    try {
      await saveSettings.mutateAsync(settings);
      toast.success("설정이 저장됐습니다.");
    } catch {
      toast.error("저장에 실패했습니다.");
    }
  }

  async function handleGenerateCategories(gen: (typeof CATEGORY_GENERATORS)[number]) {
    setGeneratingType(gen.key);
    setCollectModal({ open: true, label: gen.label, logs: [], done: false });

    try {
      const res = await fetch(gen.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: categoryCounts[gen.key] }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            const log = formatCategorySSEEvent(data);
            if (log) {
              setCollectModal((prev) => ({
                ...prev,
                logs: [...prev.logs, log],
                done: data.type === "done",
              }));
            }
          } catch {
            /* skip */
          }
        }
      }

      saveLastRun(`category_${gen.key}`);
      setLastRunMap(getLastRunMap());
      // 카테고리 생성 후 캐시 무효화
      queryClient.invalidateQueries({ queryKey: queryKeys.categories.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
    } catch {
      setCollectModal((prev) => ({
        ...prev,
        logs: [...prev.logs, "카테고리 생성 실패"],
        done: true,
      }));
    } finally {
      setGeneratingType(null);
    }
  }

  function formatCategorySSEEvent(data: Record<string, unknown>): string | null {
    if (data.type === "log") return data.message as string;
    if (data.type === "candidate") return `  → 후보: ${data.name}`;
    if (data.type === "saved") return `  ✓ 저장: ${data.name}`;
    if (data.type === "done") return `완료: ${data.created}개 카테고리 생성`;
    if (data.type === "error") return `오류: ${data.message}`;
    return null;
  }

  async function handleCollect(collector: (typeof DATA_COLLECTORS)[number]) {
    setCollectingKey(collector.key);
    setCollectModal({ open: true, label: collector.label, logs: [], done: false });

    try {
      const url = collector.key === "rss" ? `${collector.url}?days=${rssDays}` : collector.url;
      const res = await fetch(url);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            const log = formatSSEEvent(collector.key, data);
            if (log) {
              setCollectModal((prev) => ({
                ...prev,
                logs: [...prev.logs, log],
                done: data.type === "done",
              }));
            }
          } catch {
            /* skip */
          }
        }
      }

      saveLastRun(`collect_${collector.key}`);
      setLastRunMap(getLastRunMap());
      // 수집 완료 후 관련 캐시 무효화
      if (collector.key === "rss") {
        queryClient.invalidateQueries({ queryKey: queryKeys.articles });
      } else {
        queryClient.invalidateQueries({ queryKey: queryKeys.jd.trends });
        queryClient.invalidateQueries({ queryKey: queryKeys.jd.insights });
      }
    } catch {
      setCollectModal((prev) => ({ ...prev, logs: [...prev.logs, "수집 실패"], done: true }));
    } finally {
      setCollectingKey(null);
    }
  }

  function formatSSEEvent(key: string, data: Record<string, unknown>): string | null {
    if (key === "rss") {
      if (data.type === "source") return `${data.source} 수집 중...`;
      if (data.type === "progress")
        return `${data.source}: ${data.added}건 추가 (총 ${data.totalAdded}건)`;
      if (data.type === "ai") return `AI 필터링 중... (${data.count}건 판단)`;
      if (data.type === "ai_done") return `AI 필터: ${data.aiAdded}건 추가`;
      if (data.type === "done") return `수집 완료: 총 ${data.totalAdded}건`;
      if (data.type === "error") return `오류: ${data.message}`;
    }
    if (key === "wanted") {
      if (data.type === "list") return `공고 ${data.total}건 발견`;
      if (data.type === "progress") {
        const dup = data.duplicate ? " (중복)" : "";
        return `${data.current}/${data.total} ${data.company} - ${data.position}${dup}`;
      }
      if (data.type === "skills") return `${data.message}`;
      if (data.type === "ai_analysis") return `🤖 ${data.message}`;
      if (data.type === "done")
        return `완료: ${data.added}건 추가, ${data.skipped}건 중복, 스킬 ${data.skillsTracked}개`;
      if (data.type === "error") return `오류: ${data.message}`;
    }
    return null;
  }

  function addKeyword() {
    const kw = newKeyword.trim();
    if (!kw || !settings) return;
    if (settings.article_keywords.some((k) => k.toLowerCase() === kw.toLowerCase())) {
      toast.error("이미 존재하는 키워드입니다.");
      return;
    }
    setLocalSettings({ ...settings, article_keywords: [...settings.article_keywords, kw] });
    setNewKeyword("");
    keywordInputRef.current?.focus();
  }

  function removeKeyword(kw: string) {
    if (!settings) return;
    setLocalSettings({
      ...settings,
      article_keywords: settings.article_keywords.filter((k) => k !== kw),
    });
  }

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!settings) return null;

  return (
    <div className="max-w-lg space-y-6">
      {/* 카테고리 생성 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4" />
            카테고리 생성
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {CATEGORY_GENERATORS.map((gen) => {
            const lastRun = formatLastRun(lastRunMap[`category_${gen.key}`]);
            return (
              <div key={gen.key} className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <gen.icon className="text-muted-foreground h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{gen.label}</p>
                      {lastRun && (
                        <span className="text-muted-foreground text-[10px]">{lastRun}</span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">{gen.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() =>
                        setTopicCounts((c) => ({ ...c, [gen.key]: Math.max(1, c[gen.key] - 1) }))
                      }
                      className="border-input hover:bg-accent flex h-6 w-6 cursor-pointer items-center justify-center rounded border text-xs transition-colors"
                    >
                      -
                    </button>
                    <span className="w-6 text-center text-sm font-medium tabular-nums">
                      {categoryCounts[gen.key]}
                    </span>
                    <button
                      onClick={() =>
                        setTopicCounts((c) => ({ ...c, [gen.key]: Math.min(20, c[gen.key] + 1) }))
                      }
                      className="border-input hover:bg-accent flex h-6 w-6 cursor-pointer items-center justify-center rounded border text-xs transition-colors"
                    >
                      +
                    </button>
                    <span className="text-muted-foreground text-xs">개</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleGenerateCategories(gen)}
                    disabled={generatingType !== null}
                    className="shrink-0 gap-1.5"
                  >
                    {generatingType === gen.key ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      <Play className="h-3 w-3" />
                    )}
                    생성
                  </Button>
                </div>
                {gen.key !== "article" && <div className="border-border border-t" />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 데이터 수집 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Rss className="h-4 w-4" />
            데이터 수집
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {DATA_COLLECTORS.map((collector, i) => {
            const lastRun = formatLastRun(lastRunMap[`collect_${collector.key}`]);
            return (
              <div key={collector.key} className="space-y-2">
                <div className="flex items-center gap-2.5">
                  <collector.icon className="text-muted-foreground h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{collector.label}</p>
                      {lastRun && (
                        <span className="text-muted-foreground text-[10px]">{lastRun}</span>
                      )}
                    </div>
                    <p className="text-muted-foreground text-xs">{collector.description}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  {collector.key === "rss" ? (
                    <button
                      onClick={() => setShowKeywords((v) => !v)}
                      className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs transition-colors"
                    >
                      <Tag className="h-3 w-3" />
                      필터 키워드 ({settings.article_keywords.length})
                    </button>
                  ) : (
                    <div />
                  )}
                  <div className="flex items-center gap-2">
                    {collector.key === "rss" && (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={rssDays}
                          onChange={(e) =>
                            setRssDays(Math.min(90, Math.max(1, Number(e.target.value) || 1)))
                          }
                          className="border-input bg-background w-12 rounded-md border px-1.5 py-1 text-center text-xs tabular-nums"
                        />
                        <span className="text-muted-foreground text-xs">일</span>
                      </div>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCollect(collector)}
                      disabled={collectingKey !== null}
                      className="shrink-0 gap-1.5"
                    >
                      {collectingKey === collector.key ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      실행
                    </Button>
                  </div>
                </div>
                {collector.key === "rss" && showKeywords && (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {settings.article_keywords.map((kw) => (
                        <span
                          key={kw}
                          className="bg-accent flex items-center gap-1 rounded-md px-2 py-0.5 text-xs"
                        >
                          {kw}
                          <button
                            onClick={() => removeKeyword(kw)}
                            className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5">
                      <input
                        ref={keywordInputRef}
                        type="text"
                        value={newKeyword}
                        onChange={(e) => setNewKeyword(e.target.value)}
                        onCompositionStart={() => {
                          composingRef.current = true;
                        }}
                        onCompositionEnd={() => {
                          composingRef.current = false;
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !composingRef.current) addKeyword();
                        }}
                        placeholder="키워드 추가"
                        className="border-input bg-background flex-1 rounded-md border px-2 py-1 text-xs"
                      />
                      <Button variant="outline" size="sm" onClick={addKeyword} className="h-7 px-2">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-[10px]">
                      Korean FE Article은 필터 없이 전부 수집. 나머지는 키워드 → AI 순으로 필터링.
                    </p>
                  </div>
                )}
                {i < DATA_COLLECTORS.length - 1 && <div className="border-border border-t" />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 시스템 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <SlidersHorizontal className="h-4 w-4" />
            시스템
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm">통과 기준 점수</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setLocalSettings((s) =>
                    s ? { ...s, pass_score: Math.max(50, s.pass_score - 5) } : s,
                  )
                }
                className="border-input hover:bg-accent flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border text-sm transition-colors"
              >
                -
              </button>
              <span className="w-10 text-center text-sm font-medium tabular-nums">
                {settings.pass_score}
              </span>
              <button
                onClick={() =>
                  setLocalSettings((s) =>
                    s ? { ...s, pass_score: Math.min(100, s.pass_score + 5) } : s,
                  )
                }
                className="border-input hover:bg-accent flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border text-sm transition-colors"
              >
                +
              </button>
            </div>
          </div>
          <Button
            onClick={handleSave}
            disabled={saveSettings.isPending}
            variant="outline"
            className="w-full"
          >
            {saveSettings.isPending ? "저장 중..." : "설정 저장"}
          </Button>
        </CardContent>
      </Card>
      {/* 수집 모달 */}
      {collectModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="bg-background/50 absolute inset-0"
            onClick={() => setCollectModal((p) => ({ ...p, open: false }))}
          />
          <div className="bg-card border-border relative w-full max-w-md rounded-lg border p-5 shadow-lg">
            <div className="mb-3 flex items-center gap-2">
              {!collectModal.done && <RefreshCw className="h-4 w-4 animate-spin" />}
              <p className="text-sm font-medium">
                {collectModal.label} {collectModal.done ? "완료" : "수집 중..."}
              </p>
            </div>
            <div
              ref={modalLogsRef}
              className="bg-muted max-h-60 space-y-0.5 overflow-y-auto rounded-md p-3"
            >
              {collectModal.logs.map((log, i) => (
                <p key={i} className="text-muted-foreground text-xs">
                  {log}
                </p>
              ))}
              {collectModal.logs.length === 0 && (
                <p className="text-muted-foreground text-xs">준비 중...</p>
              )}
            </div>
            {collectModal.done && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setCollectModal((p) => ({ ...p, open: false }))}
              >
                닫기
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
