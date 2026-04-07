import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * POST /api/articles/[id]/generate-topic
 * 아티클에서 토픽을 생성한다.
 * body: { category_name, mission_type }
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { category_name, mission_type = "concept" } = body;

    // 아티클 가져오기
    const articleDoc = await adminDb.collection("articles").doc(id).get();
    if (!articleDoc.exists) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    const article = articleDoc.data()!;

    // 토픽 생성
    const now = new Date().toISOString();
    const topicRef = await adminDb.collection("topics").add({
      title: article.title as string,
      description: article.summary as string,
      mission_type,
      category_name: category_name ?? article.source ?? "기타",
      source_type: "article",
      source_ref: article.url as string,
      code_snippet: null,
      is_used: false,
      created_at: now,
    });

    // 아티클에 topic_generated 마크
    await adminDb.collection("articles").doc(id).update({
      topic_generated: true,
      topic_id: topicRef.id,
    });

    return NextResponse.json({ id: topicRef.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Generate topic error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
