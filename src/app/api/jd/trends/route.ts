import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentWeekStartString } from "@/lib/utils/date";

/**
 * GET /api/jd/trends?weeks=4
 * 최근 N주 스킬 트렌드 데이터 반환
 */
export async function GET() {
  try {
    // 최근 4주 데이터
    const weeks = 4;
    const currentWeekStart = getCurrentWeekStartString();
    const weekStarts: string[] = [];

    for (let i = 0; i < weeks; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() - i * 7);
      weekStarts.push(d.toISOString().split("T")[0]);
    }

    const snap = await adminDb
      .collection("jd_skill_trends")
      .where("week_start", "in", weekStarts)
      .get();

    interface TrendDoc {
      id: string;
      week_start: string;
      skill_name: string;
      mention_count: number;
    }
    const trends = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<TrendDoc, "id">) }));

    // 현재 주 스킬 Top 15 (mention_count 기준)
    const currentWeekTrends = trends
      .filter((t) => t.week_start === currentWeekStart)
      .sort((a, b) => b.mention_count - a.mention_count)
      .slice(0, 15);

    // 주차별로 그룹
    const byWeek: Record<string, Array<{ skill_name: string; mention_count: number }>> = {};
    for (const t of trends) {
      if (!byWeek[t.week_start]) byWeek[t.week_start] = [];
      byWeek[t.week_start].push({ skill_name: t.skill_name, mention_count: t.mention_count });
    }

    return NextResponse.json({
      currentWeek: currentWeekStart,
      topSkills: currentWeekTrends,
      byWeek,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
