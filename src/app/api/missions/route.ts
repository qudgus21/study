import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET() {
  try {
    const missionsSnap = await adminDb.collection("missions").orderBy("sort_order", "asc").get();

    const missions = await Promise.all(
      missionsSnap.docs.map(async (doc) => {
        const mission = { id: doc.id, ...doc.data() };

        // attempts 가져오기
        const attemptsSnap = await adminDb
          .collection("attempts")
          .where("mission_id", "==", doc.id)
          .get();

        const attempts = attemptsSnap.docs.map((a) => ({
          id: a.id,
          score: a.data().score,
          passed: a.data().passed,
          created_at: a.data().created_at,
        }));

        return { ...mission, attempts };
      }),
    );

    return NextResponse.json(missions);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch missions:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { week_id, topic_id, mission_type, sort_order = 0, topic_title, category_name } = body;

    if (!week_id || !topic_id || !mission_type) {
      return NextResponse.json(
        { error: "week_id, topic_id, mission_type are required" },
        { status: 400 },
      );
    }

    const docRef = await adminDb.collection("missions").add({
      week_id,
      topic_id,
      mission_type,
      sort_order,
      topic_title: topic_title ?? "",
      category_name: category_name ?? "",
      status: "pending",
      is_carried_over: false,
      created_at: new Date().toISOString(),
      completed_at: null,
    });

    const doc = await docRef.get();
    return NextResponse.json({ id: doc.id, ...doc.data() }, { status: 201 });
  } catch (error) {
    console.error("Failed to create mission:", error);
    return NextResponse.json({ error: "Failed to create mission" }, { status: 500 });
  }
}
