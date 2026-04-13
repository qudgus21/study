"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCategories } from "@/lib/queries/use-categories";
import { useQuestions } from "@/lib/queries/use-questions";
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

export function CategoriesClient() {
  const { data: categories = [], isLoading: catLoading } = useCategories();
  const { data: questions = [], isLoading: qLoading } = useQuestions();

  const categoryStats = useMemo((): CategoryWithStats[] => {
    return categories.map((cat) => {
      const catQuestions = questions.filter((q) => q.categories.some((c) => c.id === cat.id));
      const answered = catQuestions.filter((q) => q.attemptCount > 0);
      const scores = answered.map((q) => q.lastScore).filter((s): s is number => s != null);
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

  if (catLoading || qLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground">카테고리 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">면접 카테고리</h1>
        <p className="text-muted-foreground mt-1">
          {categories.length}개 카테고리 · {questions.length}개 질문
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {categoryStats.map((cat) => (
          <CategoryCard key={cat.id} category={cat} />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({ category }: { category: CategoryWithStats }) {
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
    <Link href={`/questions?category=${encodeURIComponent(category.name)}`}>
      <Card className="hover:bg-accent/50 h-full transition-colors">
        <CardContent className="space-y-3 p-4">
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
        </CardContent>
      </Card>
    </Link>
  );
}
