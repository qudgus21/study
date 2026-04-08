import { NextRequest } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { filterSimilarCategories } from "@/lib/categories/similarity";
import { createSSEStream } from "@/lib/categories/sse";

/**
 * POST /api/categories/generate/jd (SSE)
 * JD 갭 분석에서 RED 스킬(confidence < 40)을 카테고리로 생성한다.
 */
export async function POST(request: NextRequest) {
  const { send, close, response } = createSSEStream();

  (async () => {
    try {
      const body = await request.json();
      const count = Math.min(Math.max(Number(body.count) || 5, 1), 20);

      send({ type: "log", message: "JD 스킬 트렌드 조회 중..." });
      const { data: latestRow } = await supabase
        .from("jd_skill_trends")
        .select("collected_date")
        .order("collected_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestRow) {
        send({ type: "log", message: "JD 스킬 데이터가 없습니다." });
        send({ type: "done", created: 0 });
        close();
        return;
      }

      const latestDate = latestRow.collected_date as string;
      send({ type: "log", message: `최근 수집일: ${latestDate}` });

      const { data: trendsData } = await supabase
        .from("jd_skill_trends")
        .select("skill_name, mention_count")
        .eq("collected_date", latestDate);

      const marketSkills = (trendsData ?? [])
        .map((d) => ({
          skill_name: d.skill_name as string,
          mention_count: d.mention_count as number,
        }))
        .sort((a, b) => b.mention_count - a.mention_count)
        .slice(0, 20);

      if (marketSkills.length === 0) {
        send({ type: "log", message: "JD 스킬 데이터가 없습니다." });
        send({ type: "done", created: 0 });
        close();
        return;
      }

      send({ type: "log", message: `시장 스킬 ${marketSkills.length}개 분석` });

      // 내 역량
      const { data: skillsData } = await supabase
        .from("learning_skills")
        .select("skill_name, confidence_level");

      const mySkills = new Map<string, number>();
      for (const row of skillsData ?? []) {
        mySkills.set(row.skill_name as string, (row.confidence_level as number) ?? 0);
      }

      // RED 스킬 필터
      const redSkills = marketSkills.filter((m) => (mySkills.get(m.skill_name) ?? 0) < 40);
      send({ type: "log", message: `RED 스킬 (역량 < 40%) ${redSkills.length}개 발견` });

      if (redSkills.length === 0) {
        send({ type: "log", message: "생성할 RED 스킬이 없습니다." });
        send({ type: "done", created: 0 });
        close();
        return;
      }

      for (const s of redSkills) {
        send({ type: "candidate", name: `${s.skill_name} (JD ${s.mention_count}개)` });
      }

      // 기존 카테고리 중복 체크
      send({ type: "log", message: "기존 카테고리 조회 중..." });
      const { data: existingData } = await supabase.from("categories").select("name");
      const existingNames = (existingData ?? []).map((d) => d.name as string);
      send({ type: "log", message: `기존 카테고리 ${existingNames.length}개 확인` });

      // 유사도 검증
      const candidateNames = redSkills.map((s) => s.skill_name);
      const duplicates = await filterSimilarCategories(candidateNames, existingNames, (msg) =>
        send({ type: "log", message: msg }),
      );

      // 저장
      const now = new Date().toISOString();
      let created = 0;

      for (const market of redSkills) {
        if (created >= count) break;
        if (duplicates.has(market.skill_name.toLowerCase())) continue;

        await supabase.from("categories").insert({
          name: market.skill_name,
          description: `JD 분석 결과 ${market.skill_name}이(가) ${market.mention_count}개 JD에서 요구됩니다. 역량을 강화하세요.`,
          source_type: "jd",
          source_ref: latestDate,
          created_at: now,
        });

        created++;
        send({ type: "saved", name: market.skill_name });
      }

      send({ type: "done", created });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      send({ type: "error", message });
    } finally {
      close();
    }
  })();

  return response;
}
