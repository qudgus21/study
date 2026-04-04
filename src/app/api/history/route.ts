import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentWeekStartString } from "@/lib/utils/date";

/**
 * GET /api/history
 * 현재 주를 제외한 지난 주차 데이터를 반환한다.
 * 각 주차별 미션 통계 포함.
 */
export async function GET() {
  try {
    const currentWeekStart = getCurrentWeekStartString();

    // 모든 주차 가져오기 (최신순)
    const weeksSnap = await adminDb.collection("weeks").orderBy("week_start", "desc").get();

    const pastWeeks = weeksSnap.docs.filter((d) => d.data().week_start !== currentWeekStart);

    const history = await Promise.all(
      pastWeeks.map(async (weekDoc) => {
        const weekData = weekDoc.data();

        // 해당 주의 미션 가져오기
        const missionsSnap = await adminDb
          .collection("missions")
          .where("week_id", "==", weekDoc.id)
          .get();

        const missions = missionsSnap.docs.map((d) => d.data());

        const stats = {
          total: missions.length,
          passed: missions.filter((m) => m.status === "passed").length,
          concept: {
            total: missions.filter((m) => m.mission_type === "concept").length,
            passed: missions.filter((m) => m.mission_type === "concept" && m.status === "passed")
              .length,
          },
          discussion: {
            total: missions.filter((m) => m.mission_type === "discussion").length,
            passed: missions.filter((m) => m.mission_type === "discussion" && m.status === "passed")
              .length,
          },
          code: {
            total: missions.filter((m) => m.mission_type === "code").length,
            passed: missions.filter((m) => m.mission_type === "code" && m.status === "passed")
              .length,
          },
        };

        return {
          id: weekDoc.id,
          week_start: weekData.week_start as string,
          carried_over_count: (weekData.carried_over_count as number) ?? 0,
          stats,
        };
      }),
    );

    return NextResponse.json(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("History API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
