import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentWeekStartString, formatDateString } from "@/lib/utils/date";

type MissionType = "concept" | "discussion" | "code";

/**
 * GET /api/dashboard
 * 대시보드에 필요한 모든 데이터를 반환한다.
 */
export async function GET() {
  try {
    const weekStart = getCurrentWeekStartString();

    // 1. 현재 주 가져오기 (없으면 생성)
    let weekId: string;
    let weekData: Record<string, unknown>;

    const weeksSnap = await adminDb
      .collection("weeks")
      .where("week_start", "==", weekStart)
      .limit(1)
      .get();

    if (weeksSnap.empty) {
      const newWeek = {
        week_start: weekStart,
        goal_concept: 5,
        goal_discussion: 5,
        goal_code: 5,
        carried_over_count: 0,
        created_at: new Date().toISOString(),
      };
      const docRef = await adminDb.collection("weeks").add(newWeek);
      weekId = docRef.id;
      weekData = newWeek;
    } else {
      const doc = weeksSnap.docs[0];
      weekId = doc.id;
      weekData = doc.data();
    }

    // 2. 현재 주 미션 가져오기
    const missionsSnap = await adminDb.collection("missions").where("week_id", "==", weekId).get();

    const missions = missionsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as Array<{
      id: string;
      mission_type: MissionType;
      status: string;
      category_name: string;
      is_carried_over: boolean;
    }>;

    // 3. 타입별 진행률
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

    // 4. 스트릭 계산 (passed 상태 미션의 completed_at 기준)
    const allPassedMissions = await adminDb
      .collection("missions")
      .where("status", "==", "passed")
      .get();

    const passedDates = new Set<string>();
    for (const doc of allPassedMissions.docs) {
      const completedAt = doc.data().completed_at as string | null;
      if (completedAt) {
        passedDates.add(completedAt.split("T")[0]);
      }
    }

    const streak = calcStreak(passedDates);

    // 5. 카테고리별 통계 (learning_skills 컬렉션)
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

    // 6. 약한 영역 (confidence_level 낮은 순, 최소 1번 이상 시도한 것만)
    const weakAreas = [...categoryStats]
      .filter((s) => s.total_missions > 0)
      .sort((a, b) => a.confidence_level - b.confidence_level)
      .slice(0, 3);

    return NextResponse.json({
      week: { id: weekId, ...weekData },
      progress,
      streak,
      categoryStats,
      weakAreas,
      totalMissions: missions.length,
      completedMissions: missions.filter((m) => m.status === "passed").length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Dashboard API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * passedDates: 미션 통과 날짜 Set (YYYY-MM-DD)
 * 오늘부터 역순으로 연속 날짜를 세어 스트릭 반환
 */
function calcStreak(passedDates: Set<string>): number {
  if (passedDates.size === 0) return 0;

  let streak = 0;
  const today = new Date();

  // 오늘 활동이 없으면 어제부터 체크
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
