import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { question_id, answer_text, eval_prompt, eval_result, score, passed, feedback_summary } =
      body;

    if (!question_id || !answer_text) {
      return NextResponse.json({ error: "question_id, answer_text are required" }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Attempt 추가
    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .insert({
        question_id,
        answer_text,
        eval_prompt: eval_prompt ?? null,
        eval_result: eval_result ?? null,
        score: score ?? null,
        passed: passed ?? false,
        feedback_summary: feedback_summary ?? null,
        created_at: now,
      })
      .select()
      .single();

    if (attemptError) throw attemptError;

    // Question 상태 업데이트
    const newStatus = passed ? "passed" : "in_progress";
    const updateData: Record<string, unknown> = { status: newStatus };
    if (passed) {
      updateData.completed_at = now;
    }

    await supabase.from("questions").update(updateData).eq("id", question_id);

    return NextResponse.json(attempt, { status: 201 });
  } catch (error) {
    console.error("Failed to create attempt:", error);
    return NextResponse.json({ error: "Failed to create attempt" }, { status: 500 });
  }
}
