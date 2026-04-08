import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

/**
 * GET /api/articles?source=&unread=&bookmarked=
 * 아티클 목록 반환 (최신순, 전체 반환)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const source = searchParams.get("source");
    const unreadOnly = searchParams.get("unread") === "true";
    const bookmarkedOnly = searchParams.get("bookmarked") === "true";

    let query = supabase.from("articles").select("*").order("published_at", { ascending: false });

    if (source) query = query.eq("source", source);
    if (unreadOnly) query = query.eq("is_read", false);
    if (bookmarkedOnly) query = query.eq("is_bookmarked", true);

    const { data, error } = await query.limit(500);

    if (error) throw error;

    const items = data ?? [];
    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Articles GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
