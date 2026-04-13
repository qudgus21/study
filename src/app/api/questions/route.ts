import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

export async function GET() {
  try {
    // 질문 목록 + 카테고리 + 시도 정보 조회
    const { data: questions, error } = await supabase
      .from("questions")
      .select("*, attempts(id, score, passed, created_at)")
      .order("created_at", { ascending: false });

    if (error) throw error;

    // 질문-카테고리 매핑 조회
    const questionIds = (questions ?? []).map((q) => q.id);
    const { data: qcData } = await supabase
      .from("question_categories")
      .select("question_id, category_id, categories(id, name)")
      .in("question_id", questionIds.length > 0 ? questionIds : ["__none__"]);

    // 카테고리 매핑을 질문별로 그룹화
    const categoryMap = new Map<string, { id: string; name: string }[]>();
    for (const qc of qcData ?? []) {
      const cats = categoryMap.get(qc.question_id) ?? [];
      const cat = qc.categories as unknown as { id: string; name: string } | null;
      if (cat) cats.push({ id: cat.id, name: cat.name });
      categoryMap.set(qc.question_id, cats);
    }

    const result = (questions ?? []).map((q) => ({
      ...q,
      categories: categoryMap.get(q.id) ?? [],
    }));

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch questions:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
