import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/topics/[id] */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowed = [
      "title",
      "description",
      "mission_type",
      "category_name",
      "code_snippet",
      "is_used",
    ];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key];
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    await adminDb.collection("topics").doc(id).update(updateData);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** DELETE /api/topics/[id] */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await adminDb.collection("topics").doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
