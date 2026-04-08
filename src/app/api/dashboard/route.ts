import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { formatDateString } from "@/lib/utils/date";

type MissionType = "concept" | "discussion" | "code";

/**
 * GET /api/dashboard
 * 대시보드에 필요한 모든 데이터를 반환한다.
 */
export async function GET() {
  try {
    // 1. 전체 미션 가져오기
    const { data: missionsData, error: missionsError } = await supabase
      .from("missions")
      .select("id, mission_type, status, category_name, completed_at");

    if (missionsError) throw missionsError;

    const missions = (missionsData ?? []) as Array<{
      id: string;
      mission_type: MissionType;
      status: string;
      category_name: string;
      completed_at: string | null;
    }>;

    // 2. 타입별 통과 수
    const progress = {
      concept: { passed: 0, total: 0 },
      discussion: { passed: 0, total: 0 },
      code: { passed: 0, total: 0 },
    } as Record<MissionType, { passed: number; total: number }>;

    for (const m of missions) {
      const t = m.mission_type;
      if (t in progress) {
        progress[t].total += 1;
        if (m.status === "passed") progress[t].passed += 1;
      }
    }

    // 3. 스트릭 계산
    const passedDates = new Set<string>();
    for (const m of missions) {
      if (m.status === "passed" && m.completed_at) {
        passedDates.add(m.completed_at.split("T")[0]);
      }
    }
    const streak = calcStreak(passedDates);

    // 4. 카테고리별 통계
    const { data: skillsData } = await supabase
      .from("learning_skills")
      .select("skill_name, total_missions, passed_missions, confidence_level")
      .order("passed_missions", { ascending: false })
      .limit(20);

    const categoryStats = (skillsData ?? []).map((d) => ({
      skill_name: d.skill_name as string,
      total_missions: (d.total_missions as number) ?? 0,
      passed_missions: (d.passed_missions as number) ?? 0,
      confidence_level: (d.confidence_level as number) ?? 0,
    }));

    // 5. 약한 영역
    const weakAreas = [...categoryStats]
      .filter((s) => s.total_missions > 0)
      .sort((a, b) => a.confidence_level - b.confidence_level)
      .slice(0, 3);

    const totalMissions = missions.length;
    const completedMissions = missions.filter((m) => m.status === "passed").length;

    return NextResponse.json({
      progress,
      streak,
      categoryStats,
      weakAreas,
      totalMissions,
      completedMissions,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Dashboard API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function calcStreak(passedDates: Set<string>): number {
  if (passedDates.size === 0) return 0;

  let streak = 0;
  const today = new Date();

  const todayStr = formatDateString(today);
  let checkDate = passedDates.has(todayStr)
    ? today
    : (() => {
        const d = new Date(today);
        d.setDate(d.getDate() - 1);
        return d;
      })();

  while (true) {
    const dateStr = formatDateString(checkDate);
    if (!passedDates.has(dateStr)) break;
    streak += 1;
    const prev = new Date(checkDate);
    prev.setDate(prev.getDate() - 1);
    checkDate = prev;
  }

  return streak;
}
