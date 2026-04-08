import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

/**
 * POST /api/articles/[id]/generate-category
 * 아티클에서 카테고리를 생성한다.
 * body: { category_name }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { category_name } = body;

    // 아티클 가져오기
    const { data: article, error: artError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", id)
      .single();

    if (artError || !article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const name = category_name ?? article.source ?? "기타";

    // 중복 체크
    const { data: existing } = await supabase
      .from("categories")
      .select("id")
      .eq("name", name)
      .limit(1)
      .maybeSingle();

    let categoryId: string;

    if (existing) {
      // 기존 카테고리에 매핑
      categoryId = existing.id;
    } else {
      // 새 카테고리 생성
      const now = new Date().toISOString();
      const { data: newCat, error: catError } = await supabase
        .from("categories")
        .insert({
          name,
          description: article.summary as string,
          source_type: "article",
          source_ref: article.url as string,
          created_at: now,
        })
        .select("id")
        .single();

      if (catError || !newCat) throw catError;
      categoryId = newCat.id;
    }

    // 아티클에 마크
    await supabase
      .from("articles")
      .update({
        topic_generated: true,
        topic_id: categoryId,
      })
      .eq("id", id);

    return NextResponse.json({ id: categoryId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Generate category error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
