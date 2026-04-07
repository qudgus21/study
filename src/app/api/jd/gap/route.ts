import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

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
    const latestSnap = await adminDb
      .collection("jd_skill_trends")
      .orderBy("collected_date", "desc")
      .limit(1)
      .get();

    if (latestSnap.empty) {
      return NextResponse.json({
        gaps: [],
        summary: { green: 0, yellow: 0, red: 0 },
        collectedDate: null,
      });
    }

    const latestDate = latestSnap.docs[0].data().collected_date as string;

    // 해당 날짜의 스킬 트렌드 (Top 20)
    const trendsSnap = await adminDb
      .collection("jd_skill_trends")
      .where("collected_date", "==", latestDate)
      .get();

    const marketSkills = trendsSnap.docs
      .map((d) => ({
        skill_name: d.data().skill_name as string,
        mention_count: d.data().mention_count as number,
      }))
      .sort((a, b) => b.mention_count - a.mention_count)
      .slice(0, 20);

    // 내 학습 스킬 역량
    const skillsSnap = await adminDb.collection("learning_skills").get();
    const mySkills = new Map<string, number>();
    for (const doc of skillsSnap.docs) {
      mySkills.set(doc.data().skill_name as string, (doc.data().confidence_level as number) ?? 0);
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
