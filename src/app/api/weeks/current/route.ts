import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentWeekStartString } from "@/lib/utils/date";

/**
 * GET /api/weeks/current
 * 현재 주 데이터를 반환한다. 없으면 자동 생성.
 */
export async function GET() {
  try {
    const weekStart = getCurrentWeekStartString();

    // 현재 주 조회
    const weeksSnap = await adminDb
      .collection("weeks")
      .where("week_start", "==", weekStart)
      .limit(1)
      .get();

    if (!weeksSnap.empty) {
      const doc = weeksSnap.docs[0];
      return NextResponse.json({ id: doc.id, ...doc.data() });
    }

    // 없으면 생성
    const newWeek = {
      week_start: weekStart,
      goal_concept: 5,
      goal_discussion: 5,
      goal_code: 5,
      carried_over_count: 0,
      created_at: new Date().toISOString(),
    };

    const docRef = await adminDb.collection("weeks").add(newWeek);
    return NextResponse.json({ id: docRef.id, ...newWeek }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
