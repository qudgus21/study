import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";

interface BulkQuestion {
  title: string;
  description?: string;
  difficulty?: string;
  categories?: string[];
  reference_content?: string;
  category_id?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { questions } = body as { questions: BulkQuestion[] };

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: "No questions provided" }, { status: 400 });
    }

    let savedCount = 0;

    for (const q of questions) {
      const { data: newQ, error: qError } = await supabase
        .from("questions")
        .insert({
          title: q.title,
          description: q.description ?? null,
          reference_content: q.reference_content ?? null,
          difficulty: q.difficulty ?? "mid",
          source_type: "category",
          source_ref: q.category_id ?? null,
          status: "pending",
        })
        .select("id")
        .single();

      if (qError || !newQ) continue;

      // 카테고리 연결
      const catNames = q.categories ?? [];
      if (catNames.length > 0) {
        const { data: cats } = await supabase.from("categories").select("id").in("name", catNames);

        if (cats && cats.length > 0) {
          await supabase.from("question_categories").insert(
            cats.map((c) => ({
              question_id: newQ.id,
              category_id: c.id,
            })),
          );
        }
      }
      savedCount++;
    }

    return NextResponse.json({ saved: savedCount, total: questions.length }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
