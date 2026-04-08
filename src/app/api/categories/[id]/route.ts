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
