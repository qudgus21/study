"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import {
  useCategories,
  useCategoryMissions,
  useCreateCategory,
  useDeleteCategory,
  useDeleteMission,
  type CategoryData,
} from "@/lib/queries/use-categories";

interface NewCategoryForm {
  name: string;
  description: string;
}

interface DeleteInfo {
  categoryId: string;
  categoryName: string;
  missionCount: number;
  attemptCount: number;
  passedCount: number;
  inProgressCount: number;
}

const sourceConfig: Record<string, { label: string; style: string }> = {
  ai: {
    label: "AI 생성",
    style: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  jd: { label: "JD", style: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
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
  const { data: categories = [], isLoading } = useCategories();
  const queryClient = useQueryClient();
  const createCategory = useCreateCategory();
  const deleteCategory = useDeleteCategory();
  const deleteMission = useDeleteMission();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewCategoryForm>(emptyForm);

  // 확장된 카테고리 ID
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 한 번이라도 펼쳐본 카테고리 (미션 캐시 유지용)
  const [expandedOnce, setExpandedOnce] = useState<Set<string>>(new Set());

  // 미션 생성
  const [missionCount, setMissionCount] = useState(3);
  const [generatingCategoryId, setGeneratingCategoryId] = useState<string | null>(null);
  const [generateModal, setGenerateModal] = useState<{
    open: boolean;
    label: string;
    logs: string[];
    done: boolean;
  }>({ open: false, label: "", logs: [], done: false });
  const modalLogsRef = useRef<HTMLDivElement>(null);

  // 삭제 확인 모달
  const [deleteInfo, setDeleteInfo] = useState<DeleteInfo | null>(null);

  // 필터 & 페이지네이션
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("");
  const [page, setPage] = useState(1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // 모달 로그 자동 스크롤
  useEffect(() => {
    if (modalLogsRef.current) {
      modalLogsRef.current.scrollTop = modalLogsRef.current.scrollHeight;
    }
  }, [generateModal.logs]);

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

  function handleToggle(categoryId: string) {
    if (expandedId !== categoryId) {
      setExpandedOnce((prev) => {
        if (prev.has(categoryId)) return prev;
        const next = new Set(prev);
        next.add(categoryId);
        return next;
      });
    }
    setExpandedId(expandedId === categoryId ? null : categoryId);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name) {
      toast.error("카테고리 이름은 필수입니다.");
      return;
    }
    try {
      await createCategory.mutateAsync(form);
      setForm(emptyForm);
      setShowForm(false);
      toast.success("카테고리가 추가됐습니다.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "카테고리 생성에 실패했습니다.");
    }
  }

  async function handleDeleteClick(id: string, name: string) {
    setDeleteInfo({
      categoryId: id,
      categoryName: name,
      missionCount: 0,
      attemptCount: 0,
      passedCount: 0,
      inProgressCount: 0,
    });
    try {
      const res = await fetch(`/api/categories/${id}`);
      const data = await res.json();
      setDeleteInfo({
        categoryId: id,
        categoryName: name,
        missionCount: data.missionCount ?? 0,
        attemptCount: data.attemptCount ?? 0,
        passedCount: data.passedCount ?? 0,
        inProgressCount: data.inProgressCount ?? 0,
      });
    } catch {
      // 조회 실패해도 모달은 열어둠 (count 0으로 표시)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteInfo) return;
    try {
      await deleteCategory.mutateAsync(deleteInfo.categoryId);
      if (expandedId === deleteInfo.categoryId) setExpandedId(null);
      setDeleteInfo(null);
      toast.success("삭제됐습니다.");
    } catch {
      toast.error("삭제에 실패했습니다.");
    }
  }

  async function handleDeleteMission(missionId: string, categoryId: string) {
    try {
      await deleteMission.mutateAsync({ missionId, categoryId });
      toast.success("미션이 삭제됐습니다.");
    } catch {
      toast.error("미션 삭제에 실패했습니다.");
    }
  }

  const handleGenerateMissions = useCallback(
    async (categoryId: string, categoryName: string) => {
      setGeneratingCategoryId(categoryId);
      setGenerateModal({ open: true, label: `${categoryName} 미션 생성`, logs: [], done: false });

      try {
        const res = await fetch(`/api/categories/${categoryId}/missions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: missionCount }),
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
              const log = formatMissionSSEEvent(data);
              if (log) {
                setGenerateModal((prev) => ({
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

        queryClient.invalidateQueries({ queryKey: queryKeys.categories.missions(categoryId) });
        queryClient.invalidateQueries({ queryKey: queryKeys.missions.all });
        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard });
      } catch {
        setGenerateModal((prev) => ({
          ...prev,
          logs: [...prev.logs, "미션 생성 실패"],
          done: true,
        }));
      } finally {
        setGeneratingCategoryId(null);
      }
    },
    [missionCount, queryClient],
  );

  function formatMissionSSEEvent(data: Record<string, unknown>): string | null {
    if (data.type === "log") return data.message as string;
    if (data.type === "saved") return `  ✓ ${data.title} (${data.mission_type})`;
    if (data.type === "done") return `완료: ${data.created}개 미션 생성`;
    if (data.type === "error") return `오류: ${data.message}`;
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 삭제 확인 모달 */}
      <Dialog open={!!deleteInfo} onOpenChange={(open) => !open && setDeleteInfo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>카테고리 삭제</DialogTitle>
            <DialogDescription>
              <strong>{deleteInfo?.categoryName}</strong> 카테고리를 삭제하면 관련된 모든 데이터가
              함께 삭제됩니다.
            </DialogDescription>
          </DialogHeader>

          {deleteInfo && (deleteInfo.missionCount > 0 || deleteInfo.attemptCount > 0) ? (
            <div className="bg-destructive/5 border-destructive/20 rounded-md border p-3 text-sm">
              <p className="text-destructive mb-2 font-medium">삭제되는 데이터</p>
              <ul className="text-muted-foreground space-y-1 text-xs">
                <li>
                  미션 <strong className="text-foreground">{deleteInfo.missionCount}개</strong>
                  {deleteInfo.passedCount > 0 && (
                    <span className="text-green-600"> (통과 {deleteInfo.passedCount}개)</span>
                  )}
                  {deleteInfo.inProgressCount > 0 && (
                    <span className="text-yellow-600">
                      {" "}
                      (진행중 {deleteInfo.inProgressCount}개)
                    </span>
                  )}
                </li>
                {deleteInfo.attemptCount > 0 && (
                  <li>
                    풀이 기록{" "}
                    <strong className="text-foreground">{deleteInfo.attemptCount}건</strong>
                  </li>
                )}
              </ul>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">관련된 미션이 없습니다.</p>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteInfo(null)}>
              취소
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmDelete}
              disabled={deleteCategory.isPending}
            >
              {deleteCategory.isPending ? "삭제 중..." : "삭제"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                <Button type="submit" size="sm" disabled={createCategory.isPending}>
                  {createCategory.isPending ? "저장 중..." : "저장"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 카테고리 목록 */}
      {isLoading ? (
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
          {paged.map((cat) => (
            <CategoryRow
              key={cat.id}
              cat={cat}
              isExpanded={expandedId === cat.id}
              hasExpanded={expandedOnce.has(cat.id)}
              onToggle={() => handleToggle(cat.id)}
              onDeleteClick={() => handleDeleteClick(cat.id, cat.name)}
              onDeleteMission={handleDeleteMission}
              onGenerateMissions={() => handleGenerateMissions(cat.id, cat.name)}
              isGenerating={generatingCategoryId === cat.id}
              missionCount={missionCount}
              onMissionCountChange={setMissionCount}
            />
          ))}

          {/* 페이지네이션 */}
          {totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPage={goToPage} />}
        </div>
      )}

      {/* 미션 생성 모달 */}
      {generateModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="bg-background/50 absolute inset-0"
            onClick={() => generateModal.done && setGenerateModal((p) => ({ ...p, open: false }))}
          />
          <div className="bg-card border-border relative w-full max-w-md rounded-lg border p-5 shadow-lg">
            <div className="mb-3 flex items-center gap-2">
              {!generateModal.done && <RefreshCw className="h-4 w-4 animate-spin" />}
              <p className="text-sm font-medium">
                {generateModal.label} {generateModal.done ? "완료" : "중..."}
              </p>
            </div>
            <div
              ref={modalLogsRef}
              className="bg-muted max-h-60 space-y-0.5 overflow-y-auto rounded-md p-3"
            >
              {generateModal.logs.map((log, i) => (
                <p key={i} className="text-muted-foreground text-xs">
                  {log}
                </p>
              ))}
              {generateModal.logs.length === 0 && (
                <p className="text-muted-foreground text-xs">준비 중...</p>
              )}
            </div>
            {generateModal.done && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setGenerateModal((p) => ({ ...p, open: false }))}
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

function CategoryRow({
  cat,
  isExpanded,
  hasExpanded,
  onToggle,
  onDeleteClick,
  onDeleteMission,
  onGenerateMissions,
  isGenerating,
  missionCount,
  onMissionCountChange,
}: {
  cat: CategoryData;
  isExpanded: boolean;
  hasExpanded: boolean;
  onToggle: () => void;
  onDeleteClick: () => void;
  onDeleteMission: (missionId: string, categoryId: string) => void;
  onGenerateMissions: () => void;
  isGenerating: boolean;
  missionCount: number;
  onMissionCountChange: (count: number) => void;
}) {
  const { data: missions = [], isLoading: isLoadingMissions } = useCategoryMissions(
    cat.id,
    hasExpanded,
  );

  return (
    <Card>
      {/* 카테고리 헤더 */}
      <CardContent className="p-0">
        <div className="flex w-full items-center gap-3 p-3">
          <button
            onClick={onToggle}
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
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onDeleteClick}>
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
                    onClick={() => onMissionCountChange(Math.max(1, missionCount - 1))}
                    className="border-input hover:bg-accent flex h-6 w-6 cursor-pointer items-center justify-center rounded border text-xs transition-colors"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-xs font-medium tabular-nums">
                    {missionCount}
                  </span>
                  <button
                    onClick={() => onMissionCountChange(Math.min(10, missionCount + 1))}
                    className="border-input hover:bg-accent flex h-6 w-6 cursor-pointer items-center justify-center rounded border text-xs transition-colors"
                  >
                    +
                  </button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={onGenerateMissions}
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
                        onClick={() => onDeleteMission(mission.id, cat.id)}
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
