"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
  MessageSquare,
  Code,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface CategoryData {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  created_at: string;
}

interface MissionData {
  id: string;
  title: string;
  mission_type: "concept" | "discussion" | "code";
  status: string;
  attempt_count: number;
  last_score: number | null;
}

interface NewCategoryForm {
  name: string;
  description: string;
}

const sourceConfig: Record<string, { label: string; style: string }> = {
  ai: {
    label: "AI 생성",
    style: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  jd: { label: "JD 갭", style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  article: {
    label: "아티클",
    style: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  manual: {
    label: "수동",
    style: "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
  },
};

const typeIcons = {
  concept: BookOpen,
  discussion: MessageSquare,
  code: Code,
};

const typeLabels = {
  concept: "개념",
  discussion: "토론",
  code: "코드",
};

const statusStyles: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-yellow-500/10 text-yellow-600",
  passed: "bg-green-500/10 text-green-600",
};

const emptyForm: NewCategoryForm = { name: "", description: "" };

const PER_PAGE = 10;
const PAGE_GROUP_SIZE = 5;

type SourceFilter = "" | "ai" | "jd" | "article" | "manual";

export function CategoriesClient() {
  const [categories, setCategories] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewCategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // 확장된 카테고리 ID
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 카테고리별 미션 캐시
  const [missionsMap, setMissionsMap] = useState<Record<string, MissionData[]>>({});
  const [loadingMissions, setLoadingMissions] = useState<string | null>(null);

  // 미션 생성
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [missionCount, setMissionCount] = useState(3);

  // 필터 & 페이지네이션
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("");
  const [page, setPage] = useState(1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items: CategoryData[] } | null) => data?.items && setCategories(data.items))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // 드롭다운 외부 클릭 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = sourceFilter
    ? categories.filter((c) => c.source_type === sourceFilter)
    : categories;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function selectSource(value: SourceFilter) {
    setSourceFilter(value);
    setDropdownOpen(false);
    setPage(1);
  }

  function goToPage(p: number) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const fetchMissions = useCallback(async (categoryId: string) => {
    setLoadingMissions(categoryId);
    try {
      const res = await fetch(`/api/categories/${categoryId}/missions`);
      const data = (await res.json()) as { missions: MissionData[] };
      setMissionsMap((prev) => ({ ...prev, [categoryId]: data.missions }));
    } catch {
      toast.error("미션 목록을 불러올 수 없습니다.");
    } finally {
      setLoadingMissions(null);
    }
  }, []);

  function handleToggle(categoryId: string) {
    if (expandedId === categoryId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(categoryId);
    if (!missionsMap[categoryId]) {
      fetchMissions(categoryId);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) {
      toast.error("카테고리 이름은 필수입니다.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error: string };
        toast.error(err.error);
        return;
      }
      const created = (await res.json()) as CategoryData;
      setCategories((prev) => [created, ...prev]);
      setForm(emptyForm);
      setShowForm(false);
      toast.success("카테고리가 추가됐습니다.");
    } catch {
      toast.error("카테고리 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteCategory(id: string) {
    try {
      await fetch(`/api/categories/${id}`, { method: "DELETE" });
      setCategories((prev) => prev.filter((c) => c.id !== id));
      if (expandedId === id) setExpandedId(null);
      toast.success("삭제됐습니다.");
    } catch {
      toast.error("삭제에 실패했습니다.");
    }
  }

  async function handleDeleteMission(missionId: string, categoryId: string) {
    try {
      await fetch(`/api/missions/${missionId}`, { method: "DELETE" });
      setMissionsMap((prev) => ({
        ...prev,
        [categoryId]: prev[categoryId]?.filter((m) => m.id !== missionId) ?? [],
      }));
      toast.success("미션이 삭제됐습니다.");
    } catch {
      toast.error("미션 삭제에 실패했습니다.");
    }
  }

  async function handleGenerateMissions(categoryId: string) {
    setGeneratingId(categoryId);
    try {
      const res = await fetch(`/api/categories/${categoryId}/missions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: missionCount }),
      });
      const data = (await res.json()) as { error?: string; created: number };
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success(`${data.created}개 미션 생성 완료`);
      // 미션 목록 새로고침
      await fetchMissions(categoryId);
    } catch {
      toast.error("미션 생성에 실패했습니다.");
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* 상단 */}
      <div className="flex items-center justify-between">
        {/* 소스 타입 드롭다운 */}
        <div ref={dropdownRef} className="relative inline-block">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="border-input bg-background hover:bg-accent flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors"
          >
            {sourceFilter ? sourceConfig[sourceFilter].label : "전체"}
            <span className="text-muted-foreground ml-1 text-xs">({filtered.length})</span>
            <ChevronDown className="h-3.5 w-3.5 opacity-50" />
          </button>
          {dropdownOpen && (
            <div className="bg-popover border-border absolute left-0 z-50 mt-1 w-40 rounded-md border py-1 shadow-md">
              <button
                onClick={() => selectSource("")}
                className={`hover:bg-accent w-full px-3 py-1.5 text-left text-sm transition-colors ${
                  !sourceFilter ? "text-primary font-medium" : ""
                }`}
              >
                전체 ({categories.length})
              </button>
              <div className="border-border my-1 border-t" />
              {(["ai", "jd", "article", "manual"] as const).map((key) => {
                const count = categories.filter((c) => c.source_type === key).length;
                return (
                  <button
                    key={key}
                    onClick={() => selectSource(key)}
                    className={`hover:bg-accent w-full px-3 py-1.5 text-left text-sm transition-colors ${
                      sourceFilter === key ? "text-primary font-medium" : ""
                    }`}
                  >
                    <span
                      className={`mr-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sourceConfig[key].style}`}
                    >
                      {sourceConfig[key].label}
                    </span>
                    ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <Button size="sm" onClick={() => setShowForm((v) => !v)} className="gap-2">
          <Plus className="h-3.5 w-3.5" />
          카테고리 추가
        </Button>
      </div>

      {/* 추가 폼 */}
      {showForm && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleCreate} className="space-y-3">
              <input
                type="text"
                placeholder="카테고리 이름 *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
              <textarea
                placeholder="설명 (선택)"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                rows={2}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                  취소
                </Button>
                <Button type="submit" size="sm" disabled={saving}>
                  {saving ? "저장 중..." : "저장"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 카테고리 목록 */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-muted-foreground flex h-48 items-center justify-center rounded-lg border border-dashed text-sm">
          카테고리가 없습니다. 설정에서 생성하거나 직접 추가하세요.
        </div>
      ) : (
        <div className="space-y-2">
          {paged.map((cat) => {
            const isExpanded = expandedId === cat.id;
            const missions = missionsMap[cat.id] ?? [];
            const isLoadingMissions = loadingMissions === cat.id;
            const isGenerating = generatingId === cat.id;

            return (
              <Card key={cat.id}>
                {/* 카테고리 헤더 */}
                <CardContent className="p-0">
                  <div className="flex w-full items-center gap-3 p-3">
                    <button
                      onClick={() => handleToggle(cat.id)}
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
                      ) : (
                        <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium">{cat.name}</p>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sourceConfig[cat.source_type]?.style ?? "bg-gray-100 text-gray-700"}`}
                          >
                            {sourceConfig[cat.source_type]?.label ?? cat.source_type}
                          </span>
                          {missions.length > 0 && (
                            <span className="text-muted-foreground text-[10px]">
                              미션 {missions.length}개
                            </span>
                          )}
                        </div>
                        {cat.description && (
                          <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                            {cat.description}
                          </p>
                        )}
                      </div>
                    </button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => handleDeleteCategory(cat.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* 확장 영역 */}
                  {isExpanded && (
                    <div className="border-t px-3 pt-2 pb-3">
                      {/* 미션 생성 영역 */}
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setMissionCount((c) => Math.max(1, c - 1))}
                              className="border-input hover:bg-accent flex h-6 w-6 cursor-pointer items-center justify-center rounded border text-xs transition-colors"
                            >
                              -
                            </button>
                            <span className="w-5 text-center text-xs font-medium tabular-nums">
                              {missionCount}
                            </span>
                            <button
                              onClick={() => setMissionCount((c) => Math.min(10, c + 1))}
                              className="border-input hover:bg-accent flex h-6 w-6 cursor-pointer items-center justify-center rounded border text-xs transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1.5 text-xs"
                            onClick={() => handleGenerateMissions(cat.id)}
                            disabled={isGenerating}
                          >
                            {isGenerating ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Sparkles className="h-3 w-3" />
                            )}
                            미션 생성
                          </Button>
                        </div>
                      </div>

                      {/* 미션 목록 */}
                      {isLoadingMissions ? (
                        <div className="space-y-1.5">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                          ))}
                        </div>
                      ) : missions.length === 0 ? (
                        <p className="text-muted-foreground py-4 text-center text-xs">
                          아직 미션이 없습니다. 위 버튼으로 생성하세요.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {missions.map((mission) => {
                            const TypeIcon = typeIcons[mission.mission_type];
                            return (
                              <div
                                key={mission.id}
                                className="hover:bg-accent/50 flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors"
                              >
                                <TypeIcon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                                <Link href={`/missions/${mission.id}`} className="min-w-0 flex-1">
                                  <p className="truncate text-xs font-medium">{mission.title}</p>
                                </Link>
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-[10px] ${statusStyles[mission.status] ?? ""}`}
                                >
                                  {typeLabels[mission.mission_type]}
                                </Badge>
                                {mission.last_score !== null && (
                                  <span className="text-muted-foreground shrink-0 text-[10px] tabular-nums">
                                    {mission.last_score}점
                                  </span>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`shrink-0 text-[10px] ${statusStyles[mission.status] ?? ""}`}
                                >
                                  {mission.status === "passed"
                                    ? "통과"
                                    : mission.status === "in_progress"
                                      ? "진행중"
                                      : "대기"}
                                </Badge>
                                <button
                                  onClick={() => handleDeleteMission(mission.id, cat.id)}
                                  className="text-muted-foreground hover:text-destructive shrink-0 cursor-pointer p-0.5 transition-colors"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* 페이지네이션 */}
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPage={goToPage} />}
        </div>
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  const groupStart = Math.floor((page - 1) / PAGE_GROUP_SIZE) * PAGE_GROUP_SIZE + 1;
  const groupEnd = Math.min(groupStart + PAGE_GROUP_SIZE - 1, totalPages);
  const pages = Array.from({ length: groupEnd - groupStart + 1 }, (_, i) => groupStart + i);

  const btnClass =
    "flex h-8 w-8 items-center justify-center rounded-md text-sm transition-colors disabled:opacity-30 disabled:cursor-default";

  return (
    <div className="flex items-center justify-center gap-1 pt-2">
      <button
        onClick={() => onPage(1)}
        disabled={page === 1}
        className={`${btnClass} hover:bg-accent text-muted-foreground`}
      >
        <ChevronsLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => onPage(page - 1)}
        disabled={page === 1}
        className={`${btnClass} hover:bg-accent text-muted-foreground`}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPage(p)}
          className={`${btnClass} ${
            p === page
              ? "bg-primary text-primary-foreground font-medium"
              : "hover:bg-accent text-muted-foreground"
          }`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPage(page + 1)}
        disabled={page === totalPages}
        className={`${btnClass} hover:bg-accent text-muted-foreground`}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <button
        onClick={() => onPage(totalPages)}
        disabled={page === totalPages}
        className={`${btnClass} hover:bg-accent text-muted-foreground`}
      >
        <ChevronsRight className="h-4 w-4" />
      </button>
    </div>
  );
}
