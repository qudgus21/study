import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * POST /api/topics/generate/article
 * 아직 토픽으로 변환되지 않은 최신 아티클에서 토픽을 생성한다.
 * body: { count: number } (1~20, 기본 5)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const count = Math.min(Math.max(Number(body.count) || 5, 1), 20);

    // topic_generated가 아닌 최신 아티클 조회
    const articlesSnap = await adminDb
      .collection("articles")
      .where("topic_generated", "==", false)
      .orderBy("published_at", "desc")
      .limit(count)
      .get();

    if (articlesSnap.empty) {
      return NextResponse.json({ ok: true, message: "변환할 아티클이 없습니다.", created: 0 });
    }

    const now = new Date().toISOString();
    let created = 0;
    const types = ["concept", "discussion", "code"] as const;

    for (const articleDoc of articlesSnap.docs) {
      const article = articleDoc.data();
      const missionType = types[Math.floor(Math.random() * types.length)];

      const topicRef = await adminDb.collection("topics").add({
        title: article.title as string,
        description: article.summary as string,
        mission_type: missionType,
        category_name: (article.source as string) ?? "기타",
        source_type: "article",
        source_ref: article.url as string,
        code_snippet: null,
        is_used: false,
        created_at: now,
      });

      await adminDb.collection("articles").doc(articleDoc.id).update({
        topic_generated: true,
        topic_id: topicRef.id,
      });

      created++;
    }

    return NextResponse.json({ ok: true, created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("generate article topics error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
