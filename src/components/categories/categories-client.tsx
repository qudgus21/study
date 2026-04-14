"use client";

import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Sparkles, Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCategories } from "@/lib/queries/use-categories";
import { useQuestions } from "@/lib/queries/use-questions";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries/keys";
import * as LucideIcons from "lucide-react";

interface CategoryWithStats {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  questionCount: number;
  answeredCount: number;
  avgScore: number | null;
}

interface GeneratedQuestion {
  title: string;
  description?: string;
  difficulty?: string;
  categories?: string[];
  reference_content?: string;
  selected: boolean;
}

export function CategoriesClient() {
  const { data: categories = [], isLoading: catLoading } = useCategories();
  const { data: questions = [], isLoading: qLoading } = useQuestions();
  const queryClient = useQueryClient();

  const [modal, setModal] = useState<{
    open: boolean;
    categoryId: string;
    categoryName: string;
    step: "input" | "generating" | "select" | "saving";
    count: number;
    generated: GeneratedQuestion[];
    error: string | null;
  }>({
    open: false,
    categoryId: "",
    categoryName: "",
    step: "input",
    count: 5,
    generated: [],
    error: null,
  });

  const categoryStats = useMemo((): CategoryWithStats[] => {
    return categories.map((cat) => {
      const catQuestions = questions.filter((q) => q.categories.some((c) => c.id === cat.id));
      const answered = catQuestions.filter((q) => q.attemptCount > 0);
      const scores = answered.map((q) => q.bestScore).filter((s): s is number => s != null);
      const avgScore =
        scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

      return {
        id: cat.id,
        name: cat.name,
        description: cat.description ?? null,
        icon: cat.icon ?? null,
        questionCount: catQuestions.length,
        answeredCount: answered.length,
        avgScore,
      };
    });
  }, [categories, questions]);

  const openModal = useCallback((catId: string, catName: string) => {
    setModal({
      open: true,
      categoryId: catId,
      categoryName: catName,
      step: "input",
      count: 5,
      generated: [],
      error: null,
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    setModal((m) => ({ ...m, step: "generating", error: null }));

    try {
      const res = await fetch(`/api/categories/${modal.categoryId}/generate-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: modal.count }),
      });

      if (!res.ok) throw new Error("생성 요청 실패");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.questions) {
                const generated = (data.questions as GeneratedQuestion[]).map((q) => ({
                  ...q,
                  selected: true,
                }));
                setModal((m) => ({ ...m, step: "select", generated }));
              }
              if (data.parse_error) {
                setModal((m) => ({
                  ...m,
                  step: "input",
                  error: "응답 파싱 실패. 다시 시도해주세요.",
                }));
              }
              if (data.message) {
                setModal((m) => ({ ...m, step: "input", error: data.message as string }));
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      setModal((m) => ({
        ...m,
        step: "input",
        error: err instanceof Error ? err.message : "알 수 없는 오류",
      }));
    }
  }, [modal.categoryId, modal.count]);

  const toggleQuestion = useCallback((index: number) => {
    setModal((m) => {
      const generated = [...m.generated];
      generated[index] = { ...generated[index], selected: !generated[index].selected };
      return { ...m, generated };
    });
  }, []);

  const handleSave = useCallback(async () => {
    const selected = modal.generated.filter((q) => q.selected);
    if (selected.length === 0) return;

    setModal((m) => ({ ...m, step: "saving" }));

    try {
      const res = await fetch("/api/questions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: selected.map((q) => ({
            title: q.title,
            description: q.description,
            difficulty: q.difficulty,
            categories: q.categories,
            reference_content: q.reference_content,
            category_id: modal.categoryId,
          })),
        }),
      });

      if (!res.ok) throw new Error("저장 실패");

      const result = await res.json();
      queryClient.invalidateQueries({ queryKey: queryKeys.questions.all });
      setModal((m) => ({ ...m, open: false }));
    } catch {
      setModal((m) => ({ ...m, step: "select", error: "저장 실패" }));
    }
  }, [modal.generated, modal.categoryId, queryClient]);

  if (catLoading || qLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">카테고리 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 px-4 py-5 md:px-6">
      <div>
        <h1 className="text-2xl font-bold">면접 카테고리</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {categories.length}개 카테고리 · {questions.length}개 질문
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categoryStats.map((cat) => (
          <CategoryCard
            key={cat.id}
            category={cat}
            onGenerate={() => openModal(cat.id, cat.name)}
          />
        ))}
      </div>

      {/* 질문 생성 모달 */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="bg-background/50 absolute inset-0 backdrop-blur-sm"
            onClick={() =>
              modal.step !== "generating" &&
              modal.step !== "saving" &&
              setModal((m) => ({ ...m, open: false }))
            }
          />
          <div className="bg-card border-border relative w-full max-w-lg rounded-lg border p-5 shadow-lg">
            <h3 className="mb-4 font-semibold">{modal.categoryName} — 질문 생성</h3>

            {/* 개수 입력 */}
            {modal.step === "input" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm">생성 개수</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={modal.count}
                    onChange={(e) =>
                      setModal((m) => ({
                        ...m,
                        count: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
                      }))
                    }
                    className="border-input bg-background w-16 rounded-md border px-2 py-1 text-center text-sm"
                  />
                </div>
                {modal.error && <p className="text-sm text-red-500">{modal.error}</p>}
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setModal((m) => ({ ...m, open: false }))}
                    className="cursor-pointer"
                  >
                    취소
                  </Button>
                  <Button onClick={handleGenerate} className="cursor-pointer">
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    생성
                  </Button>
                </div>
              </div>
            )}

            {/* 생성 중 */}
            {modal.step === "generating" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
                <p className="text-muted-foreground text-sm">질문을 생성하고 있습니다...</p>
              </div>
            )}

            {/* 질문 선택 */}
            {modal.step === "select" && (
              <div className="space-y-4">
                <p className="text-muted-foreground text-sm">
                  {modal.generated.length}개 생성됨 · 저장할 질문을 선택하세요
                </p>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {modal.generated.map((q, i) => (
                    <label
                      key={i}
                      className={`hover:bg-accent/50 flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors ${q.selected ? "border-primary bg-primary/5" : "border-border"}`}
                    >
                      <input
                        type="checkbox"
                        checked={q.selected}
                        onChange={() => toggleQuestion(i)}
                        className="accent-primary mt-0.5 h-4 w-4 cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{q.title}</p>
                        {q.description && (
                          <p className="text-muted-foreground mt-0.5 text-xs">{q.description}</p>
                        )}
                        <div className="mt-1 flex gap-1">
                          {q.difficulty && (
                            <Badge variant="outline" className="text-[10px]">
                              {q.difficulty === "junior"
                                ? "Lv.1"
                                : q.difficulty === "mid"
                                  ? "Lv.2"
                                  : "Lv.3"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
                {modal.error && <p className="text-sm text-red-500">{modal.error}</p>}
                <div className="flex justify-between">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const allSelected = modal.generated.every((q) => q.selected);
                      setModal((m) => ({
                        ...m,
                        generated: m.generated.map((q) => ({ ...q, selected: !allSelected })),
                      }));
                    }}
                    className="cursor-pointer"
                  >
                    {modal.generated.every((q) => q.selected) ? "전체 해제" : "전체 선택"}
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setModal((m) => ({ ...m, open: false }))}
                      className="cursor-pointer"
                    >
                      취소
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={modal.generated.filter((q) => q.selected).length === 0}
                      className="cursor-pointer"
                    >
                      <Check className="mr-1.5 h-4 w-4" />
                      {modal.generated.filter((q) => q.selected).length}개 저장
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* 저장 중 */}
            {modal.step === "saving" && (
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="text-primary h-8 w-8 animate-spin" />
                <p className="text-muted-foreground text-sm">저장 중...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  onGenerate,
}: {
  category: CategoryWithStats;
  onGenerate: () => void;
}) {
  const iconName = category.icon as keyof typeof LucideIcons | null;
  const IconComponent =
    iconName && iconName in LucideIcons
      ? (LucideIcons[iconName] as React.ComponentType<{ className?: string }>)
      : LucideIcons.Folder;

  const scoreColor =
    category.avgScore == null
      ? "text-muted-foreground"
      : category.avgScore >= 80
        ? "text-green-600"
        : category.avgScore >= 65
          ? "text-yellow-600"
          : "text-red-600";

  return (
    <Card className="hover:bg-accent/50 h-full transition-colors">
      <CardContent className="space-y-3 p-4">
        <Link href={`/questions?category=${encodeURIComponent(category.name)}`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <IconComponent className="text-primary h-5 w-5" />
              <h3 className="text-sm font-semibold">{category.name}</h3>
            </div>
            {category.avgScore != null && (
              <span className={`text-lg font-bold ${scoreColor}`}>{category.avgScore}점</span>
            )}
          </div>

          {category.description && (
            <p className="text-muted-foreground line-clamp-2 text-xs">{category.description}</p>
          )}

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {category.questionCount}개 질문
            </Badge>
            {category.answeredCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {category.answeredCount}개 답변
              </Badge>
            )}
          </div>
        </Link>

        <Button
          variant="outline"
          size="sm"
          className="w-full cursor-pointer"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onGenerate();
          }}
        >
          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
          질문 생성
        </Button>
      </CardContent>
    </Card>
  );
}
