import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * GET /api/notifications
 * 알림 목록 반환 (최신 30개, 읽음 상태 포함)
 * query: ?unread=true (미읽음만)
 */
export async function GET(request: NextRequest) {
  try {
    const unreadOnly = request.nextUrl.searchParams.get("unread") === "true";

    let query = adminDb.collection("notifications").orderBy("created_at", "desc").limit(30);

    if (unreadOnly) {
      query = query.where("is_read", "==", false) as typeof query;
    }

    const snap = await query.get();
    const items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as { is_read: boolean }) }));
    const unreadCount = items.filter((n) => !n.is_read).length;

    return NextResponse.json({ items, unreadCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/notifications
 * body: { id } → 특정 알림 읽음 처리
 * body: { all: true } → 전체 읽음 처리
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.all) {
      const unreadSnap = await adminDb
        .collection("notifications")
        .where("is_read", "==", false)
        .get();

      const batch = adminDb.batch();
      for (const doc of unreadSnap.docs) {
        batch.update(doc.ref, { is_read: true });
      }
      await batch.commit();
      return NextResponse.json({ ok: true, updated: unreadSnap.size });
    }

    if (body.id) {
      await adminDb.collection("notifications").doc(body.id).update({ is_read: true });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "id or all required" }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
