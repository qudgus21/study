import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentWeekStartString, getWeekStart, formatDateString } from "@/lib/utils/date";

/**
 * GET /api/cron/daily
 * Vercel Cron이 매일 UTC 18:00에 호출 (KST 03:00).
 * 1. 현재 주 없으면 week 문서 생성
 * 2. 지난 주 미완료 미션 이월 처리
 */
export async function GET() {
  try {
    const results: string[] = [];

    // 현재 주 월요일
    const currentWeekStart = getCurrentWeekStartString();

    // 현재 주 확인
    const currentWeekSnap = await adminDb
      .collection("weeks")
      .where("week_start", "==", currentWeekStart)
      .limit(1)
      .get();

    let currentWeekId: string;
    let isNewWeek = false;

    if (currentWeekSnap.empty) {
      // 새 주 생성
      const docRef = await adminDb.collection("weeks").add({
        week_start: currentWeekStart,
        goal_concept: 5,
        goal_discussion: 5,
        goal_code: 5,
        carried_over_count: 0,
        created_at: new Date().toISOString(),
      });
      currentWeekId = docRef.id;
      isNewWeek = true;
      results.push(`Created new week: ${currentWeekStart}`);
    } else {
      currentWeekId = currentWeekSnap.docs[0].id;
    }

    // 새 주가 시작됐을 때만 이월 처리
    if (isNewWeek) {
      // 지난 주 찾기
      const prevMonday = new Date(getWeekStart());
      prevMonday.setDate(prevMonday.getDate() - 7);
      const prevWeekStart = formatDateString(prevMonday);

      const prevWeekSnap = await adminDb
        .collection("weeks")
        .where("week_start", "==", prevWeekStart)
        .limit(1)
        .get();

      if (!prevWeekSnap.empty) {
        const prevWeekId = prevWeekSnap.docs[0].id;

        // 이월 상한 가져오기
        const settingsDoc = await adminDb.collection("settings").doc("global").get();
        const carryOverLimit = (settingsDoc.data()?.carry_over_limit as number) ?? 5;

        // 지난 주 미완료 미션 (passed가 아닌 것)
        const unfinishedSnap = await adminDb
          .collection("missions")
          .where("week_id", "==", prevWeekId)
          .where("status", "!=", "passed")
          .get();

        const toCarryOver = unfinishedSnap.docs.slice(0, carryOverLimit);

        // 이월된 미션들을 현재 주로 복사
        const batch = adminDb.batch();
        for (const doc of toCarryOver) {
          const data = doc.data();
          const newRef = adminDb.collection("missions").doc();
          batch.set(newRef, {
            ...data,
            week_id: currentWeekId,
            is_carried_over: true,
            status: "pending",
            completed_at: null,
            created_at: new Date().toISOString(),
          });
        }

        // 현재 주의 carried_over_count 업데이트
        const currentWeekRef = adminDb.collection("weeks").doc(currentWeekId);
        batch.update(currentWeekRef, { carried_over_count: toCarryOver.length });

        await batch.commit();
        results.push(`Carried over ${toCarryOver.length} missions from ${prevWeekStart}`);
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Cron daily error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
