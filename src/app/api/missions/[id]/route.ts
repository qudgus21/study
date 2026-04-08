import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data: mission, error } = await supabase
      .from("missions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !mission) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    // attempts 가져오기
    const { data: attemptsData } = await supabase
      .from("attempts")
      .select("id, score, passed, feedback_summary, created_at")
      .eq("mission_id", id)
      .order("created_at", { ascending: true });

    const attempts = (attemptsData ?? []).map((a) => ({
      id: a.id,
      score: a.score ?? null,
      passed: a.passed ?? false,
      feedback_summary: a.feedback_summary ?? null,
      created_at: a.created_at ?? "",
    }));

    return NextResponse.json({ ...mission, attempts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch mission:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** DELETE /api/missions/[id] */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await supabase.from("missions").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
