import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

/**
 * GET /api/categories?source=&limit=30
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const source = searchParams.get("source");
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);

    let query = supabase.from("categories").select("*").order("created_at", { ascending: false });

    if (source) query = query.eq("source_type", source);

    const { data, error } = await query.limit(limit);

    if (error) throw error;
    return NextResponse.json({ items: data ?? [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/categories
 * 카테고리 수동 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // 중복 체크
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("name", name)
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "이미 존재하는 카테고리입니다." }, { status: 409 });
    }

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name,
        description: description ?? null,
        source_type: "manual",
        source_ref: null,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
