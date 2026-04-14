import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";

export const dynamic = "force-dynamic";

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST() {
  // reference_content가 없는 질문 조회
  const { data: questions, error } = await supabase
    .from("questions")
    .select("id, title, description")
    .is("reference_content", null)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const total = questions?.length ?? 0;
  if (total === 0) {
    return NextResponse.json({ message: "모든 질문에 참고자료가 있습니다", total: 0 });
  }

  // 카테고리 매핑 조회
  const { data: allCats } = await supabase.from("categories").select("id, name");
  const catMap = new Map((allCats ?? []).map((c) => [c.id as string, c.name as string]));

  const { data: qcRows } = await supabase
    .from("question_categories")
    .select("question_id, category_id");

  const qcMap = new Map<string, string[]>();
  for (const row of qcRows ?? []) {
    const arr = qcMap.get(row.question_id as string) ?? [];
    const name = catMap.get(row.category_id as string);
    if (name) arr.push(name);
    qcMap.set(row.question_id as string, arr);
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let completed = 0;
      let failed = 0;

      controller.enqueue(encoder.encode(sseEvent("start", { total })));

      for (const q of questions!) {
        const categoryNames = qcMap.get(q.id as string) ?? [];
        const prompt = `아래 면접 질문에 대한 참고자료를 생성하세요.

## 질문
${q.title}
${q.description ?? ""}

## 카테고리
${categoryNames.join(", ") || "일반"}

## 출력 형식
서두/인사말 없이 바로 마크다운으로 출력:

## 상세 해설
(이 질문의 핵심 개념과 모범 답변 방향을 1000자 내외로 해설. 배경, 원리, 동작 방식, 실무 적용 사례 포함)

## 핵심 개념
- 개념1: 설명
- 개념2: 설명
(면접에서 바로 쓸 수 있는 핵심 요약 3-5개)

IMPORTANT: 반드시 한국어로 응답하세요.`;

        try {
          const proc = spawnClaude({
            agentName: "follow-up-generator",
            prompt,
            timeoutMs: 60_000,
          });

          let fullText = "";
          for await (const event of parseStreamOutput(proc, 60_000)) {
            if (event.type === "text") fullText += event.content ?? "";
            if (event.type === "done") fullText = event.fullText ?? fullText;
          }

          if (fullText.trim()) {
            await supabase
              .from("questions")
              .update({ reference_content: fullText.trim() })
              .eq("id", q.id);
            completed++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }

        controller.enqueue(
          encoder.encode(
            sseEvent("progress", {
              completed,
              failed,
              total,
              current: q.title,
            }),
          ),
        );
      }

      controller.enqueue(encoder.encode(sseEvent("done", { completed, failed, total })));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
