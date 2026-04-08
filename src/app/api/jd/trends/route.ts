import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

/**
 * GET /api/jd/trends
 * 최근 수집일별 스킬 트렌드 데이터 반환
 */
export async function GET() {
  try {
    const { data: allDocs } = await supabase
      .from("jd_skill_trends")
      .select("*")
      .order("collected_date", { ascending: false });

    if (!allDocs || allDocs.length === 0) {
      return NextResponse.json({ latestDate: null, topSkills: [], byDate: {} });
    }

    const allDates = [...new Set(allDocs.map((d) => d.collected_date as string))];
    const recentDates = allDates.slice(0, 4);
    const latestDate = recentDates[0];

    interface TrendDoc {
      id: string;
      collected_date: string;
      skill_name: string;
      mention_count: number;
    }
    const trends = (allDocs as TrendDoc[]).filter((t) => recentDates.includes(t.collected_date));

    // 최신 수집일 Top 15
    const topSkills = trends
      .filter((t) => t.collected_date === latestDate)
      .sort((a, b) => b.mention_count - a.mention_count)
      .slice(0, 15);

    // 수집일별 그룹
    const byDate: Record<string, Array<{ skill_name: string; mention_count: number }>> = {};
    for (const t of trends) {
      if (!byDate[t.collected_date]) byDate[t.collected_date] = [];
      byDate[t.collected_date].push({ skill_name: t.skill_name, mention_count: t.mention_count });
    }

    return NextResponse.json({ latestDate, topSkills, byDate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
