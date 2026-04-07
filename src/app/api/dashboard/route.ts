import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { formatDateString } from "@/lib/utils/date";

type MissionType = "concept" | "discussion" | "code";

/**
 * GET /api/dashboard
 * 대시보드에 필요한 모든 데이터를 반환한다.
 */
export async function GET() {
  try {
    // 1. 전체 미션 가져오기
    const missionsSnap = await adminDb.collection("missions").get();

    const missions = missionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
      id: string;
      mission_type: MissionType;
      status: string;
      category_name: string;
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
      if (m.status === "passed") {
        const completedAt = (m as Record<string, unknown>).completed_at as string | null;
        if (completedAt) {
          passedDates.add(completedAt.split("T")[0]);
        }
      }
    }
    const streak = calcStreak(passedDates);

    // 4. 카테고리별 통계
    const skillsSnap = await adminDb
      .collection("learning_skills")
      .orderBy("passed_missions", "desc")
      .limit(20)
      .get();

    const categoryStats = skillsSnap.docs.map((d) => ({
      skill_name: d.data().skill_name as string,
      total_missions: (d.data().total_missions as number) ?? 0,
      passed_missions: (d.data().passed_missions as number) ?? 0,
      confidence_level: (d.data().confidence_level as number) ?? 0,
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
