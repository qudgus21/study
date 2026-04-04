import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getCurrentWeekStartString } from "@/lib/utils/date";

/**
 * GET /api/cron/generate-topics
 * 갭 분석 결과에서 RED 스킬을 토픽으로 자동 생성한다.
 * 매주 월요일 실행 (Vercel Cron 또는 수동 트리거).
 * 이미 생성된 토픽이 있는 스킬은 건너뛴다.
 */
export async function GET() {
  try {
    const weekStart = getCurrentWeekStartString();

    // 이번 주 JD 스킬 트렌드
    const trendsSnap = await adminDb
      .collection("jd_skill_trends")
      .where("week_start", "==", weekStart)
      .get();

    const marketSkills = trendsSnap.docs
      .map((d) => ({
        skill_name: d.data().skill_name as string,
        mention_count: d.data().mention_count as number,
      }))
      .sort((a, b) => b.mention_count - a.mention_count)
      .slice(0, 20);

    if (marketSkills.length === 0) {
      return NextResponse.json({ ok: true, message: "No market skills found", created: 0 });
    }

    // 내 역량
    const skillsSnap = await adminDb.collection("learning_skills").get();
    const mySkills = new Map<string, number>();
    for (const doc of skillsSnap.docs) {
      mySkills.set(doc.data().skill_name as string, (doc.data().confidence_level as number) ?? 0);
    }

    // 기존 갭→토픽 중복 체크용 (source_type=gap, 이번 주)
    const existingTopicsSnap = await adminDb
      .collection("topics")
      .where("source_type", "==", "gap")
      .where("created_at", ">=", weekStart)
      .get();
    const existingGapSkills = new Set(
      existingTopicsSnap.docs.map((d) => d.data().category_name as string),
    );

    const now = new Date().toISOString();
    let created = 0;
    const createdSkills: string[] = [];

    for (const market of marketSkills) {
      const confidence = mySkills.get(market.skill_name) ?? 0;

      // RED 스킬만 (confidence < 40)
      if (confidence >= 40) continue;

      // 이미 이번 주에 갭 토픽 생성된 스킬 스킵
      if (existingGapSkills.has(market.skill_name)) continue;

      // 토픽 생성 (개념/토론/코드 3가지 타입 중 랜덤)
      const types = ["concept", "discussion", "code"] as const;
      const missionType = types[Math.floor(Math.random() * types.length)];

      await adminDb.collection("topics").add({
        title: `${market.skill_name} 심화 학습`,
        description: `JD 분석 결과 ${market.skill_name}이(가) 이번 주 ${market.mention_count}개 JD에서 요구됩니다. 역량을 강화하세요.`,
        mission_type: missionType,
        category_id: null,
        category_name: market.skill_name,
        difficulty: "intermediate",
        source_type: "gap",
        source_ref: weekStart,
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
    console.error("generate-topics cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
