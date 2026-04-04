import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { fetchWantedJobs } from "@/lib/wanted/crawler";
import { getCurrentWeekStartString } from "@/lib/utils/date";

/**
 * GET /api/cron/wanted
 * 원티드 프론트엔드 JD를 수집하고 스킬 트렌드를 집계한다.
 */
export async function GET() {
  try {
    const jobs = await fetchWantedJobs(20);

    if (jobs.length === 0) {
      return NextResponse.json({ ok: true, message: "No jobs fetched", added: 0 });
    }

    const weekStart = getCurrentWeekStartString();
    const skillCount: Record<string, number> = {};
    const skillJdIds: Record<string, string[]> = {};
    let added = 0;
    let skipped = 0;

    for (const job of jobs) {
      // 중복 체크
      const exists = await adminDb
        .collection("wanted_jds")
        .where("wanted_id", "==", job.wanted_id)
        .limit(1)
        .get();

      if (!exists.empty) {
        skipped++;
        continue;
      }

      const docRef = await adminDb.collection("wanted_jds").add({
        ...job,
        crawled_at: new Date().toISOString(),
      });

      // 스킬 카운트 집계
      const allSkills = [...new Set([...job.required_skills, ...job.preferred_skills])];
      for (const skill of allSkills) {
        skillCount[skill] = (skillCount[skill] ?? 0) + 1;
        if (!skillJdIds[skill]) skillJdIds[skill] = [];
        skillJdIds[skill].push(docRef.id);
      }

      added++;
    }

    // jd_skill_trends upsert (현재 주차)
    for (const [skill, count] of Object.entries(skillCount)) {
      const trendSnap = await adminDb
        .collection("jd_skill_trends")
        .where("week_start", "==", weekStart)
        .where("skill_name", "==", skill)
        .limit(1)
        .get();

      if (trendSnap.empty) {
        await adminDb.collection("jd_skill_trends").add({
          week_start: weekStart,
          skill_name: skill,
          mention_count: count,
          sample_jd_ids: skillJdIds[skill].slice(0, 5),
        });
      } else {
        const prev = trendSnap.docs[0].data();
        await trendSnap.docs[0].ref.update({
          mention_count: (prev.mention_count as number) + count,
          sample_jd_ids: [...(prev.sample_jd_ids as string[]), ...skillJdIds[skill]].slice(0, 5),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      added,
      skipped,
      skillsTracked: Object.keys(skillCount).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Wanted cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
