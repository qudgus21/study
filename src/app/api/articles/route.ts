import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * GET /api/articles?source=&unread=&bookmarked=&limit=20&cursor=
 * 아티클 목록 반환 (최신순, 커서 기반 페이지네이션)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const source = searchParams.get("source");
    const unreadOnly = searchParams.get("unread") === "true";
    const bookmarkedOnly = searchParams.get("bookmarked") === "true";
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);
    const cursor = searchParams.get("cursor");

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

    // 커서 기반 페이지네이션
    if (cursor) {
      const cursorDoc = await adminDb.collection("articles").doc(cursor).get();
      if (cursorDoc.exists) {
        query = query.startAfter(cursorDoc) as typeof query;
      }
    }

    const snap = await query.limit(limit + 1).get();
    const docs = snap.docs;

    const hasMore = docs.length > limit;
    const items = docs.slice(0, limit).map((d) => ({ id: d.id, ...d.data() }));
    const nextCursor = hasMore ? docs[limit - 1].id : null;

    return NextResponse.json({ items, nextCursor, hasMore });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Articles GET error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
