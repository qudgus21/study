import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export interface GapItem {
  skill_name: string;
  market_count: number;
  confidence_level: number;
  status: "green" | "yellow" | "red";
}

/**
 * GET /api/jd/gap
 * 시장 요구 스킬(jd_skill_trends) vs 내 역량(learning_skills) 갭 분석
 * 가장 최근 수집일 기준
 */
export async function GET() {
  try {
    // 가장 최근 수집일 찾기
    const { data: latestRow } = await supabase
      .from("jd_skill_trends")
      .select("collected_date")
      .order("collected_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!latestRow) {
      return NextResponse.json({
        gaps: [],
        summary: { green: 0, yellow: 0, red: 0 },
        collectedDate: null,
      });
    }

    const latestDate = latestRow.collected_date as string;

    // 해당 날짜의 스킬 트렌드 (Top 20)
    const { data: trendsData } = await supabase
      .from("jd_skill_trends")
      .select("skill_name, mention_count")
      .eq("collected_date", latestDate)
      .order("mention_count", { ascending: false })
      .limit(20);

    const marketSkills = (trendsData ?? []) as Array<{
      skill_name: string;
      mention_count: number;
    }>;

    // 내 학습 스킬 역량
    const { data: skillsData } = await supabase
      .from("learning_skills")
      .select("skill_name, confidence_level");

    const mySkills = new Map<string, number>();
    for (const row of skillsData ?? []) {
      mySkills.set(row.skill_name as string, (row.confidence_level as number) ?? 0);
    }

    // 갭 계산
    const gaps: GapItem[] = marketSkills.map((market) => {
      const confidence = mySkills.get(market.skill_name) ?? 0;

      let status: GapItem["status"];
      if (confidence >= 70) status = "green";
      else if (confidence >= 40) status = "yellow";
      else status = "red";

      return {
        skill_name: market.skill_name,
        market_count: market.mention_count,
        confidence_level: confidence,
        status,
      };
    });

    const summary = {
      green: gaps.filter((g) => g.status === "green").length,
      yellow: gaps.filter((g) => g.status === "yellow").length,
      red: gaps.filter((g) => g.status === "red").length,
    };

    return NextResponse.json({ gaps, summary, collectedDate: latestDate });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
