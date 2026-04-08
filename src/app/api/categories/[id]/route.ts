import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

type Params = { params: Promise<{ id: string }> };

/** PATCH /api/categories/[id] */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const allowed = ["name", "description"];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updateData[key] = body[key];
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields" }, { status: 400 });
    }

    await supabase.from("categories").update(updateData).eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** GET /api/categories/[id] — 카테고리 상세 + 삭제 영향 범위 */
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const [{ count: missionCount }, { data: missions }] = await Promise.all([
      supabase.from("missions").select("*", { count: "exact", head: true }).eq("category_id", id),
      supabase.from("missions").select("id, status").eq("category_id", id),
    ]);

    const missionIds = missions?.map((m) => m.id) ?? [];
    let attemptCount = 0;
    if (missionIds.length > 0) {
      const { count } = await supabase
        .from("attempts")
        .select("*", { count: "exact", head: true })
        .in("mission_id", missionIds);
      attemptCount = count ?? 0;
    }

    const passedCount = missions?.filter((m) => m.status === "passed").length ?? 0;
    const inProgressCount = missions?.filter((m) => m.status === "in_progress").length ?? 0;

    return NextResponse.json({
      missionCount: missionCount ?? 0,
      attemptCount,
      passedCount,
      inProgressCount,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** DELETE /api/categories/[id] */
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    await supabase.from("categories").delete().eq("id", id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
