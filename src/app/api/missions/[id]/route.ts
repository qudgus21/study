import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const missionDoc = await adminDb.collection("missions").doc(id).get();

    if (!missionDoc.exists) {
      return NextResponse.json({ error: "Mission not found" }, { status: 404 });
    }

    const missionData = missionDoc.data()!;

    // 토픽 가져오기
    let topicDescription: string | null = null;
    let codeSnippet: string | null = null;
    if (missionData.topic_id) {
      const topicDoc = await adminDb.collection("topics").doc(missionData.topic_id).get();
      if (topicDoc.exists) {
        const topicData = topicDoc.data()!;
        topicDescription = topicData.description ?? null;
        codeSnippet = topicData.code_snippet ?? null;
      }
    }

    // attempts 가져오기
    const attemptsSnap = await adminDb.collection("attempts").where("mission_id", "==", id).get();

    const attempts = attemptsSnap.docs
      .map((a) => ({
        id: a.id,
        score: a.data().score ?? null,
        passed: a.data().passed ?? false,
        feedback_summary: a.data().feedback_summary ?? null,
        created_at: a.data().created_at ?? "",
      }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

    return NextResponse.json({
      id: missionDoc.id,
      ...missionData,
      topic_description: topicDescription,
      code_snippet: codeSnippet,
      attempts,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to fetch mission:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
