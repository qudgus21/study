import { supabase } from "@/lib/supabase/client";
import { crawlWantedJobs } from "@/lib/wanted/crawler";
import { analyzeJds } from "@/lib/wanted/jd-analyzer";
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
        const collectedJds: Array<{
          company_name: string;
          position_title: string;
          raw_description: string;
        }> = [];
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

            // AI 분석용으로 모든 JD 수집 (중복 포함)
            collectedJds.push({
              company_name: job.company_name,
              position_title: job.position_title,
              raw_description: job.raw_description,
            });

            // 중복 체크
            const { data: existing } = await supabase
              .from("wanted_jds")
              .select("id")
              .eq("wanted_id", job.wanted_id)
              .limit(1)
              .maybeSingle();

            if (existing) {
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

            const { data: insertedJd } = await supabase
              .from("wanted_jds")
              .insert({
                ...job,
                crawled_at: new Date().toISOString(),
              })
              .select("id")
              .single();

            const jdId = insertedJd?.id ?? "";
            const allSkills = [...new Set([...job.required_skills, ...job.preferred_skills])];
            for (const skill of allSkills) {
              skillCount[skill] = (skillCount[skill] ?? 0) + 1;
              if (!skillJdIds[skill]) skillJdIds[skill] = [];
              skillJdIds[skill].push(jdId);
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
          const { data: existingTrend } = await supabase
            .from("jd_skill_trends")
            .select("id, mention_count, sample_jd_ids")
            .eq("collected_date", collectedDate)
            .eq("skill_name", skill)
            .limit(1)
            .maybeSingle();

          if (!existingTrend) {
            await supabase.from("jd_skill_trends").insert({
              collected_date: collectedDate,
              skill_name: skill,
              mention_count: count,
              sample_jd_ids: skillJdIds[skill].slice(0, 5),
            });
          } else {
            await supabase
              .from("jd_skill_trends")
              .update({
                mention_count: (existingTrend.mention_count as number) + count,
                sample_jd_ids: [
                  ...((existingTrend.sample_jd_ids as string[]) ?? []),
                  ...skillJdIds[skill],
                ].slice(0, 5),
              })
              .eq("id", existingTrend.id);
          }
        }

        // AI 인사이트 분석
        if (collectedJds.length > 0) {
          send({ type: "ai_analysis", message: "AI 인사이트 분석 시작..." });

          const insight = await analyzeJds(collectedJds, (msg) =>
            send({ type: "ai_analysis", message: msg }),
          );

          if (insight) {
            // 같은 날짜 기존 인사이트 삭제 후 저장
            await supabase.from("jd_insights").delete().eq("collected_date", collectedDate);

            await supabase.from("jd_insights").insert(insight);
            send({ type: "ai_analysis", message: "AI 인사이트 저장 완료" });
          } else {
            send({ type: "ai_analysis", message: "AI 분석 실패 (스킬 트렌드는 정상 저장됨)" });
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
