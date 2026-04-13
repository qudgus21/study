"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Search, Trash2, ChevronLeft, ChevronRight, CornerDownRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuestions, useDeleteQuestion } from "@/lib/queries/use-questions";
import type { QuestionCardData } from "@/lib/queries/use-questions";

const PAGE_SIZE = 10;

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
  const [categoryFilter, setCategoryFilter] = useState<string>("전체");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("전체");
  const [sourceFilter, setSourceFilter] = useState<string>("전체");
  const [page, setPage] = useState(1);

  // 고유 카테고리 목록
  const allCategories = useMemo(() => {
    const names = new Set<string>();
    for (const q of questions) {
      for (const cat of q.categories) names.add(cat.name);
    }
    return ["전체", ...Array.from(names).sort()];
  }, [questions]);

  // 필터링
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

  // 통계
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
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">면접 질문</h1>
        <p className="text-muted-foreground mt-1">
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

        <div className="flex flex-wrap gap-2">
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
              <TabsTrigger value="junior">Junior</TabsTrigger>
              <TabsTrigger value="mid">Mid</TabsTrigger>
              <TabsTrigger value="senior">Senior</TabsTrigger>
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

          {/* 카테고리 필터 */}
          <select
            className="border-input bg-background rounded-md border px-3 py-1.5 text-sm"
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
          >
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 질문 리스트 */}
      <div className="space-y-3">
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
        <div className="flex items-center justify-center gap-2">
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

function QuestionCard({
  question,
  onDelete,
}: {
  question: QuestionCardData;
  onDelete: () => void;
}) {
  return (
    <Link href={`/questions/${question.id}`}>
      <Card className="hover:bg-accent/50 transition-colors">
        <CardContent className="flex items-start justify-between gap-4 p-4">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center gap-2">
              {question.chainDepth > 0 && (
                <CornerDownRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              )}
              <h3 className="truncate text-sm font-medium">{question.title}</h3>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className={difficultyColors[question.difficulty]}>
                {question.difficulty}
              </Badge>
              <Badge variant="outline" className={statusColors[question.status]}>
                {statusLabels[question.status]}
              </Badge>
              {question.categories.map((cat) => (
                <Badge key={cat.id} variant="secondary" className="text-xs">
                  {cat.name}
                </Badge>
              ))}
            </div>

            {question.attemptCount > 0 && (
              <p className="text-muted-foreground text-xs">
                {question.attemptCount}회 시도
                {question.lastScore != null && ` · 최근 ${question.lastScore}점`}
              </p>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </Link>
  );
}
