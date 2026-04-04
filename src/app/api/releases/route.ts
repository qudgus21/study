import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * GET /api/releases?repo=&limit=20
 * GitHub 릴리즈 목록 반환 (최신순)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const repo = searchParams.get("repo");
    const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50);

    let query = adminDb.collection("github_releases").orderBy("published_at", "desc");

    if (repo) {
      query = query.where("repo", "==", repo) as typeof query;
    }

    const snap = await query.limit(limit).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
