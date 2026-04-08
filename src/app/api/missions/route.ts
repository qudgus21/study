import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("missions")
      .select("*, attempts(id, score, passed, created_at)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const missions = (data ?? []).map((doc) => {
      const title = doc.title ?? "";
      return { ...doc, title };
    });

    return NextResponse.json(missions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch missions:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { category_id, mission_type, title, description, code_snippet, category_name } = body;

    if (!category_id || !mission_type || !title) {
      return NextResponse.json(
        { error: "category_id, mission_type, title are required" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("missions")
      .insert({
        category_id,
        category_name: category_name ?? "",
        mission_type,
        title,
        description: description ?? null,
        code_snippet: code_snippet ?? null,
        status: "pending",
        created_at: new Date().toISOString(),
        completed_at: null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Failed to create mission:", error);
    return NextResponse.json({ error: "Failed to create mission" }, { status: 500 });
  }
}
