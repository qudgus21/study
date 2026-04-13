"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuestions, useDeleteQuestion } from "@/lib/queries/use-questions";
import type { QuestionCardData } from "@/lib/queries/use-questions";

const PAGE_SIZE = 15;

const difficultyLabels: Record<string, string> = {
  junior: "Lv.1",
  mid: "Lv.2",
  senior: "Lv.3",
};

const difficultyColors: Record<string, string> = {
  junior: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  mid: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  senior: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
};

const statusLabels: Record<string, string> = {
  pending: "대기",
  in_progress: "진행 중",
  passed: "통과",
};

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  passed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function QuestionListClient() {
  const { data: questions = [], isLoading } = useQuestions();
  const deleteMutation = useDeleteQuestion();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(() => {
    if (typeof window === "undefined") return "전체";
    return new URLSearchParams(window.location.search).get("category") ?? "전체";
  });
  const [difficultyFilter, setDifficultyFilter] = useState<string>("전체");
  const [sourceFilter, setSourceFilter] = useState<string>("전체");
  const [page, setPage] = useState(1);

  const allCategories = useMemo(() => {
    const names = new Set<string>();
    for (const q of questions) {
      for (const cat of q.categories) names.add(cat.name);
    }
    return ["전체", ...Array.from(names).sort()];
  }, [questions]);

  const filtered = useMemo(() => {
    return questions.filter((q) => {
      if (search && !q.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (categoryFilter !== "전체" && !q.categories.some((c) => c.name === categoryFilter))
        return false;
      if (difficultyFilter !== "전체" && q.difficulty !== difficultyFilter) return false;
      if (sourceFilter === "이력서" && q.sourceType !== "resume") return false;
      if (sourceFilter === "일반" && q.sourceType === "resume") return false;
      return true;
    });
  }, [questions, search, categoryFilter, difficultyFilter, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = useMemo(() => {
    const total = questions.length;
    const passed = questions.filter((q) => q.status === "passed").length;
    const inProgress = questions.filter((q) => q.status === "in_progress").length;
    return { total, passed, inProgress };
  }, [questions]);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">질문 목록 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 px-4 py-5 md:px-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">면접 질문</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          전체 {stats.total}개 · 통과 {stats.passed}개 · 진행 중 {stats.inProgress}개
        </p>
      </div>

      {/* 필터 */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="질문 검색..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* 난이도 필터 */}
          <Tabs
            value={difficultyFilter}
            onValueChange={(v) => {
              setDifficultyFilter(v);
              setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="전체">전체</TabsTrigger>
              <TabsTrigger value="junior">Lv.1</TabsTrigger>
              <TabsTrigger value="mid">Lv.2</TabsTrigger>
              <TabsTrigger value="senior">Lv.3</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* 출처 필터 */}
          <Tabs
            value={sourceFilter}
            onValueChange={(v) => {
              setSourceFilter(v);
              setPage(1);
            }}
          >
            <TabsList>
              <TabsTrigger value="전체">전체</TabsTrigger>
              <TabsTrigger value="일반">일반</TabsTrigger>
              <TabsTrigger value="이력서">이력서</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* 카테고리 드롭다운 */}
          <CustomDropdown
            value={categoryFilter}
            options={allCategories}
            onChange={(v) => {
              setCategoryFilter(v);
              setPage(1);
            }}
          />
        </div>
      </div>

      {/* 질문 리스트 */}
      <div className="flex flex-col gap-3">
        {paginated.length === 0 ? (
          <div className="text-muted-foreground py-12 text-center">
            {search || categoryFilter !== "전체" || difficultyFilter !== "전체"
              ? "필터 조건에 맞는 질문이 없습니다"
              : "질문이 없습니다"}
          </div>
        ) : (
          paginated.map((q) => (
            <QuestionCard key={q.id} question={q} onDelete={() => deleteMutation.mutate(q.id)} />
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-muted-foreground text-sm">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

// 커스텀 드롭다운
function CustomDropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="border-input bg-background hover:bg-accent flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors"
      >
        {value}
        <ChevronDown className="h-3.5 w-3.5 opacity-50" />
      </button>
      {open && (
        <div className="bg-popover border-border absolute top-full z-50 mt-1 max-h-64 w-56 overflow-y-auto rounded-md border py-1 shadow-md">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              className={`hover:bg-accent w-full cursor-pointer px-3 py-1.5 text-left text-sm transition-colors ${
                opt === value ? "bg-accent font-medium" : ""
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  onDelete,
}: {
  question: QuestionCardData;
  onDelete: () => void;
}) {
  return (
    <Link href={`/questions/${question.id}`}>
      <Card className="hover:bg-accent/50 border-border border transition-colors">
        <CardContent className="flex items-start justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-2">
              {question.chainDepth > 0 && (
                <CornerDownRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              )}
              <h3 className="text-sm leading-snug font-medium">{question.title}</h3>
            </div>

            <div className="flex flex-wrap gap-1">
              <Badge
                variant="outline"
                className={`text-[10px] ${difficultyColors[question.difficulty]}`}
              >
                {difficultyLabels[question.difficulty]}
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${statusColors[question.status]}`}>
                {statusLabels[question.status]}
              </Badge>
              {question.categories.map((cat) => (
                <Badge key={cat.id} variant="secondary" className="text-[10px]">
                  {cat.name}
                </Badge>
              ))}
              {question.attemptCount > 0 && (
                <span className="text-muted-foreground ml-1 text-[10px]">
                  {question.attemptCount}회
                  {question.lastScore != null && ` · ${question.lastScore}점`}
                </span>
              )}
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive h-7 w-7 shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
