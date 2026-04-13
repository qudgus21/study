import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { formatDateString } from "@/lib/utils/date";

export async function GET() {
  try {
    // 1. 전체 질문 + 카테고리 매핑
    const { data: questionsData } = await supabase
      .from("questions")
      .select("id, status, difficulty, completed_at");

    const questions = questionsData ?? [];
    const totalQuestions = questions.length;
    const passedQuestions = questions.filter((q) => q.status === "passed").length;
    const inProgressQuestions = questions.filter((q) => q.status === "in_progress").length;

    // 2. 전체 시도 + 점수
    const { data: attemptsData } = await supabase
      .from("attempts")
      .select("question_id, score, passed, created_at")
      .order("created_at", { ascending: false });

    const attempts = attemptsData ?? [];
    const scores = attempts
      .map((a) => a.score as number | null)
      .filter((s): s is number => s != null);
    const avgScore =
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;
    const totalAttempts = attempts.length;

    // 3. 스트릭 계산 (답변한 날짜 기준)
    const attemptDates = new Set<string>();
    for (const a of attempts) {
      if (a.created_at) attemptDates.add((a.created_at as string).split("T")[0]);
    }
    const streak = calcStreak(attemptDates);

    // 4. 카테고리별 통계
    const { data: qcData } = await supabase
      .from("question_categories")
      .select("question_id, category_id, categories(name)");

    const categoryQuestionMap = new Map<string, Set<string>>();
    for (const qc of qcData ?? []) {
      const catName = (qc.categories as unknown as { name: string } | null)?.name;
      if (!catName) continue;
      const set = categoryQuestionMap.get(catName) ?? new Set();
      set.add(qc.question_id);
      categoryQuestionMap.set(catName, set);
    }

    // 카테고리별 평균 점수 계산
    const attemptScoreMap = new Map<string, number[]>();
    for (const a of attempts) {
      if (a.score == null) continue;
      const existing = attemptScoreMap.get(a.question_id) ?? [];
      existing.push(a.score as number);
      attemptScoreMap.set(a.question_id, existing);
    }

    const categoryStats = Array.from(categoryQuestionMap.entries()).map(([name, questionIds]) => {
      const catScores: number[] = [];
      for (const qId of questionIds) {
        const qScores = attemptScoreMap.get(qId);
        if (qScores && qScores.length > 0) catScores.push(qScores[0]); // 최근 점수
      }
      const catAvg =
        catScores.length > 0
          ? Math.round(catScores.reduce((a, b) => a + b, 0) / catScores.length)
          : null;

      return {
        name,
        totalQuestions: questionIds.size,
        answeredQuestions: catScores.length,
        avgScore: catAvg,
      };
    });

    // 5. 취약 영역 (평균 점수 낮은 순)
    const weakAreas = [...categoryStats]
      .filter((s) => s.avgScore != null)
      .sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0))
      .slice(0, 3);

    // 6. 최근 답변 히스토리
    const recentAttempts = attempts.slice(0, 10).map((a) => ({
      questionId: a.question_id,
      score: a.score,
      passed: a.passed,
      createdAt: a.created_at,
    }));

    // 7. 아티클/카테고리 수
    const { count: totalArticles } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true });

    const { count: totalCategories } = await supabase
      .from("categories")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      totalQuestions,
      passedQuestions,
      inProgressQuestions,
      totalAttempts,
      avgScore,
      streak,
      categoryStats,
      weakAreas,
      recentAttempts,
      totalArticles: totalArticles ?? 0,
      totalCategories: totalCategories ?? 0,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Dashboard API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function calcStreak(dates: Set<string>): number {
  if (dates.size === 0) return 0;

  let streak = 0;
  const today = new Date();
  const todayStr = formatDateString(today);
  let checkDate = dates.has(todayStr)
    ? today
    : (() => {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        return d;
      })();

  while (true) {
    const dateStr = formatDateString(checkDate);
    if (!dates.has(dateStr)) break;
    streak += 1;
    const prev = new Date(checkDate);
    prev.setDate(prev.getDate() - 1);
    checkDate = prev;
  }

  return streak;
}
