import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

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

    let query = adminDb.collection("articles").orderBy("published_at", "desc");

    if (source) {
      query = query.where("source", "==", source) as typeof query;
    }
    if (unreadOnly) {
      query = query.where("is_read", "==", false) as typeof query;
    }
    if (bookmarkedOnly) {
      query = query.where("is_bookmarked", "==", true) as typeof query;
    }

    const snap = await query.limit(500).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Articles GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
