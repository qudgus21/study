import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mission_id, answer_text, eval_prompt, eval_result, score, passed, feedback_summary } =
      body;

    if (!mission_id || !answer_text || !eval_prompt) {
      return NextResponse.json(
        { error: "mission_id, answer_text, eval_prompt are required" },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    // Attempt 추가
    const attemptRef = await adminDb.collection("attempts").add({
      mission_id,
      answer_text,
      eval_prompt,
      eval_result: eval_result ?? null,
      score: score ?? null,
      passed: passed ?? false,
      feedback_summary: feedback_summary ?? null,
      created_at: now,
    });

    // Mission 상태 업데이트
    const newStatus = passed ? "passed" : "in_progress";
    const updateData: Record<string, unknown> = { status: newStatus };
    if (passed) {
      updateData.completed_at = now;
    }

    await adminDb.collection("missions").doc(mission_id).update(updateData);

    // learning_skills 업데이트 (passed일 때만 category_name 기준으로 upsert)
    if (passed) {
      const missionDoc = await adminDb.collection("missions").doc(mission_id).get();
      const categoryName = missionDoc.data()?.category_name as string | undefined;

      if (categoryName) {
        const skillsSnap = await adminDb
          .collection("learning_skills")
          .where("skill_name", "==", categoryName)
          .limit(1)
          .get();

        const newConfidence = Math.min(100, Math.round((score ?? 0) * 0.6 + 40));

        if (skillsSnap.empty) {
          await adminDb.collection("learning_skills").add({
            skill_name: categoryName,
            total_missions: 1,
            passed_missions: 1,
            confidence_level: newConfidence,
            last_practiced_at: now,
          });
        } else {
          const skillRef = skillsSnap.docs[0].ref;
          const prev = skillsSnap.docs[0].data();
          const prevConfidence = (prev.confidence_level as number) ?? 0;
          // confidence는 이전값과 새값의 평균으로 완만하게 업데이트
          const updatedConfidence = Math.round((prevConfidence + newConfidence) / 2);

          await skillRef.update({
            total_missions: FieldValue.increment(1),
            passed_missions: FieldValue.increment(1),
            confidence_level: updatedConfidence,
            last_practiced_at: now,
          });
        }
      }
    } else {
      // 실패한 경우에도 total_missions는 증가
      const missionDoc = await adminDb.collection("missions").doc(mission_id).get();
      const categoryName = missionDoc.data()?.category_name as string | undefined;

      if (categoryName) {
        const skillsSnap = await adminDb
          .collection("learning_skills")
          .where("skill_name", "==", categoryName)
          .limit(1)
          .get();

        if (!skillsSnap.empty) {
          await skillsSnap.docs[0].ref.update({
            total_missions: FieldValue.increment(1),
            last_practiced_at: now,
          });
        }
      }
    }

    const attemptDoc = await attemptRef.get();
    return NextResponse.json({ id: attemptDoc.id, ...attemptDoc.data() }, { status: 201 });
  } catch (error) {
    console.error("Failed to create attempt:", error);
    return NextResponse.json({ error: "Failed to create attempt" }, { status: 500 });
  }
}
