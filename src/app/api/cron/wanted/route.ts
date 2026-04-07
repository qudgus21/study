import { adminDb } from "@/lib/firebase/admin";
import { crawlWantedJobs } from "@/lib/wanted/crawler";
import { formatDateString } from "@/lib/utils/date";

/**
 * GET /api/cron/wanted
 * SSE 스트리밍으로 원티드 JD 수집 진행 상황을 실시간 전달
 */
export async function GET() {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        const collectedDate = formatDateString(new Date());
        const skillCount: Record<string, number> = {};
        const skillJdIds: Record<string, string[]> = {};
        let added = 0;
        let skipped = 0;

        for await (const event of crawlWantedJobs()) {
          if (event.type === "list") {
            send({ type: "list", total: event.total });
            continue;
          }

          if (event.type === "error") {
            send({ type: "error", message: event.message });
            continue;
          }

          if (event.type === "job" && event.job) {
            const job = event.job;

            // 중복 체크
            const exists = await adminDb
              .collection("wanted_jds")
              .where("wanted_id", "==", job.wanted_id)
              .limit(1)
              .get();

            if (!exists.empty) {
              skipped++;
              send({
                type: "progress",
                current: event.current,
                total: event.total,
                added,
                skipped,
                company: job.company_name,
                position: job.position_title,
                duplicate: true,
              });
              continue;
            }

            const docRef = await adminDb.collection("wanted_jds").add({
              ...job,
              crawled_at: new Date().toISOString(),
            });

            const allSkills = [...new Set([...job.required_skills, ...job.preferred_skills])];
            for (const skill of allSkills) {
              skillCount[skill] = (skillCount[skill] ?? 0) + 1;
              if (!skillJdIds[skill]) skillJdIds[skill] = [];
              skillJdIds[skill].push(docRef.id);
            }

            added++;
            send({
              type: "progress",
              current: event.current,
              total: event.total,
              added,
              skipped,
              company: job.company_name,
              position: job.position_title,
            });
          }
        }

        // 스킬 트렌드 집계
        send({ type: "skills", message: "스킬 트렌드 집계 중..." });

        for (const [skill, count] of Object.entries(skillCount)) {
          const trendSnap = await adminDb
            .collection("jd_skill_trends")
            .where("collected_date", "==", collectedDate)
            .where("skill_name", "==", skill)
            .limit(1)
            .get();

          if (trendSnap.empty) {
            await adminDb.collection("jd_skill_trends").add({
              collected_date: collectedDate,
              skill_name: skill,
              mention_count: count,
              sample_jd_ids: skillJdIds[skill].slice(0, 5),
            });
          } else {
            const prev = trendSnap.docs[0].data();
            await trendSnap.docs[0].ref.update({
              mention_count: (prev.mention_count as number) + count,
              sample_jd_ids: [...(prev.sample_jd_ids as string[]), ...skillJdIds[skill]].slice(
                0,
                5,
              ),
            });
          }
        }

        send({ type: "done", added, skipped, skillsTracked: Object.keys(skillCount).length });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
