import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * PATCH /api/articles/[id]
 * is_read, is_bookmarked 업데이트
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if (typeof body.is_read === "boolean") updateData.is_read = body.is_read;
    if (typeof body.is_bookmarked === "boolean") updateData.is_bookmarked = body.is_bookmarked;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await adminDb.collection("articles").doc(id).update(updateData);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
