import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * POST /api/topics/generate/jd
 * JD 갭 분석에서 RED 스킬(confidence < 40)을 토픽으로 생성한다.
 * 가장 최근 수집일 기준.
 * body: { count: number } (1~20, 기본 5)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const count = Math.min(Math.max(Number(body.count) || 5, 1), 20);

    // 가장 최근 수집일 찾기
    const latestSnap = await adminDb
      .collection("jd_skill_trends")
      .orderBy("collected_date", "desc")
      .limit(1)
      .get();

    if (latestSnap.empty) {
      return NextResponse.json({ ok: true, message: "JD 스킬 데이터가 없습니다.", created: 0 });
    }

    const latestDate = latestSnap.docs[0].data().collected_date as string;

    // 해당 날짜의 JD 스킬 트렌드
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

    if (marketSkills.length === 0) {
      return NextResponse.json({ ok: true, message: "JD 스킬 데이터가 없습니다.", created: 0 });
    }

    // 내 역량
    const skillsSnap = await adminDb.collection("learning_skills").get();
    const mySkills = new Map<string, number>();
    for (const doc of skillsSnap.docs) {
      mySkills.set(doc.data().skill_name as string, (doc.data().confidence_level as number) ?? 0);
    }

    // 기존 jd 토픽 중복 체크 (같은 skill_name)
    const existingSnap = await adminDb.collection("topics").where("source_type", "==", "jd").get();
    const existingSkills = new Set(existingSnap.docs.map((d) => d.data().category_name as string));

    const now = new Date().toISOString();
    let created = 0;
    const createdSkills: string[] = [];
    const types = ["concept", "discussion", "code"] as const;

    for (const market of marketSkills) {
      if (created >= count) break;

      const confidence = mySkills.get(market.skill_name) ?? 0;
      if (confidence >= 40) continue;
      if (existingSkills.has(market.skill_name)) continue;

      const missionType = types[Math.floor(Math.random() * types.length)];

      await adminDb.collection("topics").add({
        title: `${market.skill_name} 심화 학습`,
        description: `JD 분석 결과 ${market.skill_name}이(가) ${market.mention_count}개 JD에서 요구됩니다. 역량을 강화하세요.`,
        mission_type: missionType,
        category_name: market.skill_name,
        source_type: "jd",
        source_ref: latestDate,
        code_snippet: null,
        is_used: false,
        created_at: now,
      });

      created++;
      createdSkills.push(market.skill_name);
    }

    return NextResponse.json({ ok: true, created, skills: createdSkills });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate jd topics error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
