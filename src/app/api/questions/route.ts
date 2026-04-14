import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. 질문 목록
    const { data: questions, error: qError } = await supabase
      .from("questions")
      .select("*, attempts!attempts_question_id_fkey(id, score, passed, created_at)")
      .order("created_at", { ascending: false });

    if (qError) {
      console.error("questions query error:", qError);
      throw qError;
    }

    // 2. 카테고리 목록
    const { data: cats, error: catError } = await supabase.from("categories").select("id, name");
    if (catError) console.error("categories query error:", catError);
    const catMap = new Map((cats ?? []).map((c) => [c.id as string, c.name as string]));

    // 3. 질문-카테고리 매핑
    const { data: qcRows, error: qcError } = await supabase
      .from("question_categories")
      .select("question_id, category_id");
    if (qcError) console.error("question_categories query error:", qcError);

    const qcMap = new Map<string, { id: string; name: string }[]>();
    for (const row of qcRows ?? []) {
      const qId = row.question_id as string;
      const cId = row.category_id as string;
      const name = catMap.get(cId);
      if (!name) continue;
      const arr = qcMap.get(qId) ?? [];
      arr.push({ id: cId, name });
      qcMap.set(qId, arr);
    }

    // 4. 합치기
    const result = (questions ?? []).map((q) => ({
      ...q,
      categories: qcMap.get(q.id as string) ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch questions:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
