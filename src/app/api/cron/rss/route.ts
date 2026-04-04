import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { RSS_SOURCES } from "@/lib/rss/sources";
import { fetchRssSource } from "@/lib/rss/fetcher";

/**
 * GET /api/cron/rss
 * RSS 6개 소스에서 아티클을 수집해 Firestore에 저장한다.
 * 이미 존재하는 URL은 건너뛴다.
 * 새 아티클이 생기면 notifications 컬렉션에도 추가.
 */
export async function GET() {
  try {
    const results: { source: string; added: number; skipped: number }[] = [];

    for (const source of RSS_SOURCES) {
      const articles = await fetchRssSource(source);
      let added = 0;
      let skipped = 0;

      for (const article of articles) {
        if (!article.url) {
          skipped++;
          continue;
        }

        // URL 중복 체크
        const existing = await adminDb
          .collection("articles")
          .where("url", "==", article.url)
          .limit(1)
          .get();

        if (!existing.empty) {
          skipped++;
          continue;
        }

        const now = new Date().toISOString();
        await adminDb.collection("articles").add({
          ...article,
          is_read: false,
          is_bookmarked: false,
          created_at: now,
        });

        // 알림 생성 (새 아티클)
        await adminDb.collection("notifications").add({
          type: "article",
          title: `새 아티클: ${article.source}`,
          body: article.title,
          ref_url: article.url,
          is_read: false,
          created_at: now,
        });

        added++;
      }

      results.push({ source: source.name, added, skipped });
    }

    const totalAdded = results.reduce((s, r) => s + r.added, 0);
    return NextResponse.json({ ok: true, totalAdded, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("RSS cron error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
