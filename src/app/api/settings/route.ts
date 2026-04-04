import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

const GLOBAL_DOC = "global";

/** GET /api/settings */
export async function GET() {
  try {
    const doc = await adminDb.collection("settings").doc(GLOBAL_DOC).get();

    if (!doc.exists) {
      const defaults = {
        carry_over_limit: 5,
        weekly_goal_concept: 5,
        weekly_goal_discussion: 5,
        weekly_goal_code: 5,
        pass_score: 80,
        updated_at: new Date().toISOString(),
      };
      await adminDb.collection("settings").doc(GLOBAL_DOC).set(defaults);
      return NextResponse.json(defaults);
    }

    return NextResponse.json(doc.data());
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

/** PATCH /api/settings */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const allowed = [
      "carry_over_limit",
      "weekly_goal_concept",
      "weekly_goal_discussion",
      "weekly_goal_code",
      "pass_score",
    ];

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowed) {
      if (key in body && typeof body[key] === "number") {
        updateData[key] = body[key];
      }
    }

    await adminDb.collection("settings").doc(GLOBAL_DOC).set(updateData, { merge: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
