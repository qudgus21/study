import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data: question, error } = await supabase
      .from("questions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !question) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    // 카테고리 조회
    const { data: qcData } = await supabase
      .from("question_categories")
      .select("categories(id, name)")
      .eq("question_id", id);

    const categories = (qcData ?? [])
      .map((qc) => qc.categories as unknown as { id: string; name: string } | null)
      .filter(Boolean);

    // attempts 조회
    const { data: attemptsData } = await supabase
      .from("attempts")
      .select("id, answer_text, score, passed, feedback_summary, eval_result, created_at")
      .eq("question_id", id)
      .order("created_at", { ascending: true });

    const attempts = (attemptsData ?? []).map((a) => ({
      id: a.id,
      answerText: a.answer_text,
      score: a.score ?? null,
      passed: a.passed ?? false,
      feedbackSummary: a.feedback_summary ?? null,
      evalResult: a.eval_result ?? null,
      createdAt: a.created_at ?? "",
    }));

    // 부모 질문 체인 조회 (꼬리질문인 경우)
    const parentChain: { id: string; title: string }[] = [];
    if (question.parent_question_id) {
      let currentParentId: string | null = question.parent_question_id;
      while (currentParentId) {
        const { data: parent } = await supabase
          .from("questions")
          .select("id, title, parent_question_id")
          .eq("id", currentParentId)
          .single();
        if (parent) {
          parentChain.unshift({ id: parent.id, title: parent.title });
          currentParentId = parent.parent_question_id;
        } else {
          break;
        }
      }
    }

    return NextResponse.json({
      ...question,
      categories,
      attempts,
      parentChain,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch question:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await supabase.from("questions").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
