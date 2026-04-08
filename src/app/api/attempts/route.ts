import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mission_id, answer_text, eval_prompt, eval_result, score, passed, feedback_summary } =
      body;

    if (!mission_id || !answer_text) {
      return NextResponse.json(
        { error: "mission_id, answer_text, eval_prompt are required" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    // Attempt 추가
    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .insert({
        mission_id,
        answer_text,
        eval_prompt,
        eval_result: eval_result ?? null,
        score: score ?? null,
        passed: passed ?? false,
        feedback_summary: feedback_summary ?? null,
        created_at: now,
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    // Mission 상태 업데이트
    const newStatus = passed ? "passed" : "in_progress";
    const updateData: Record<string, unknown> = { status: newStatus };
    if (passed) {
      updateData.completed_at = now;
    }

    await supabase.from("missions").update(updateData).eq("id", mission_id);

    // learning_skills 업데이트 (passed일 때만 category_name 기준으로 upsert)
    if (passed) {
      const { data: mission } = await supabase
        .from("missions")
        .select("category_name")
        .eq("id", mission_id)
        .single();

      const categoryName = mission?.category_name as string | undefined;

      if (categoryName) {
        const { data: existing } = await supabase
          .from("learning_skills")
          .select("*")
          .eq("skill_name", categoryName)
          .limit(1)
          .maybeSingle();

        const newConfidence = Math.min(100, Math.round((score ?? 0) * 0.6 + 40));

        if (!existing) {
          await supabase.from("learning_skills").insert({
            skill_name: categoryName,
            total_missions: 1,
            passed_missions: 1,
            confidence_level: newConfidence,
            last_practiced_at: now,
          });
        } else {
          const prevConfidence = (existing.confidence_level as number) ?? 0;
          const updatedConfidence = Math.round((prevConfidence + newConfidence) / 2);

          await supabase
            .from("learning_skills")
            .update({
              total_missions: existing.total_missions + 1,
              passed_missions: existing.passed_missions + 1,
              confidence_level: updatedConfidence,
              last_practiced_at: now,
            })
            .eq("skill_name", categoryName);
        }
      }
    } else {
      // 실패한 경우에도 total_missions는 증가
      const { data: mission } = await supabase
        .from("missions")
        .select("category_name")
        .eq("id", mission_id)
        .single();

      const categoryName = mission?.category_name as string | undefined;

      if (categoryName) {
        const { data: existing } = await supabase
          .from("learning_skills")
          .select("*")
          .eq("skill_name", categoryName)
          .limit(1)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("learning_skills")
            .update({
              total_missions: existing.total_missions + 1,
              last_practiced_at: now,
            })
            .eq("skill_name", categoryName);
        }
      }
    }

    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    console.error("Failed to create attempt:", error);
    return NextResponse.json({ error: "Failed to create attempt" }, { status: 500 });
  }
}
