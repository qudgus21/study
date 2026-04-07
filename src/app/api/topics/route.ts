import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

/**
 * GET /api/topics?category=&source=&unused=true&limit=30
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const category = searchParams.get("category");
    const source = searchParams.get("source");
    const unusedOnly = searchParams.get("unused") === "true";
    const limit = Math.min(Number(searchParams.get("limit") ?? 30), 100);

    let query = adminDb.collection("topics").orderBy("created_at", "desc");

    if (category) query = query.where("category_name", "==", category) as typeof query;
    if (source) query = query.where("source_type", "==", source) as typeof query;
    if (unusedOnly) query = query.where("is_used", "==", false) as typeof query;

    const snap = await query.limit(limit).get();
    const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/topics
 * 토픽 수동 생성
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, description, mission_type, category_name, code_snippet } = body;

    if (!title || !mission_type || !category_name) {
      return NextResponse.json(
        { error: "title, mission_type, category_name are required" },
        { status: 400 },
      );
    }

    const docRef = await adminDb.collection("topics").add({
      title,
      description: description ?? null,
      mission_type,
      category_name,
      source_type: "ai",
      source_ref: null,
      code_snippet: code_snippet ?? null,
      is_used: false,
      created_at: new Date().toISOString(),
    });

    const doc = await docRef.get();
    return NextResponse.json({ id: doc.id, ...doc.data() }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
