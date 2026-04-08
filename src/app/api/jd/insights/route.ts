import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import type { JdInsight } from "@/lib/wanted/jd-analyzer";

/**
 * GET /api/jd/insights
 * 최신 AI 인사이트 반환
 */
export async function GET() {
  try {
    const { data } = await supabase
      .from("jd_insights")
      .select("*")
      .order("collected_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({ insight: (data as JdInsight) ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
