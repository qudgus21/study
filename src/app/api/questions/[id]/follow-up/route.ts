import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { spawnClaude, parseStreamOutput, buildFollowUpPrompt } from "@/lib/evaluate/claude-runner";

type Params = { params: Promise<{ id: string }> };

interface FollowUpRequest {
  user_answer: string;
  score: number;
  feedback_summary: string;
}

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: FollowUpRequest;
  try {
    body = (await req.json()) as FollowUpRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 원본 질문 조회
  const { data: question, error: qError } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .single();

  if (qError || !question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  // max_chain_depth 확인
  const { data: settings } = await supabase
    .from("settings")
    .select("max_chain_depth")
    .eq("id", "global")
    .single();

  const maxDepth = settings?.max_chain_depth ?? 3;
  if (question.chain_depth >= maxDepth) {
    return NextResponse.json(
      { error: `최대 꼬리질문 깊이(${maxDepth})에 도달했습니다` },
      { status: 400 },
    );
  }

  // 카테고리 이름 조회
  const { data: qcData } = await supabase
    .from("question_categories")
    .select("categories(name)")
    .eq("question_id", id);

  const categoryNames = (qcData ?? [])
    .map((qc) => (qc.categories as unknown as { name: string } | null)?.name)
    .filter(Boolean) as string[];

  const prompt = buildFollowUpPrompt({
    originalQuestion: question.title,
    userAnswer: body.user_answer,
    score: body.score,
    feedbackSummary: body.feedback_summary,
    categoryNames,
  });

  const childProcess = spawnClaude({
    agentName: "follow-up-generator",
    prompt,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        for await (const event of parseStreamOutput(childProcess)) {
          switch (event.type) {
            case "text":
              fullText += event.content ?? "";
              controller.enqueue(encoder.encode(sseEvent("text", { content: event.content })));
              break;
            case "done": {
              // JSON 파싱하여 꼬리질문 DB 저장
              try {
                const jsonMatch =
                  fullText.match(/```json\s*([\s\S]*?)\s*```/) ||
                  fullText.match(/\{[\s\S]*"title"[\s\S]*\}/);
                const jsonStr = jsonMatch?.[1] ?? jsonMatch?.[0] ?? fullText;
                const followUp = JSON.parse(jsonStr);

                // questions 테이블에 삽입
                const { data: newQ, error: insertError } = await supabase
                  .from("questions")
                  .insert({
                    title: followUp.title,
                    description: followUp.description,
                    reference_content: followUp.reference_content ?? null,
                    difficulty: followUp.difficulty ?? "mid",
                    source_type: "follow_up",
                    source_ref: id,
                    parent_question_id: id,
                    chain_depth: question.chain_depth + 1,
                    status: "pending",
                  })
                  .select()
                  .single();

                if (insertError) throw insertError;

                // 카테고리 연결
                const catNames: string[] = followUp.categories ?? categoryNames;
                if (catNames.length > 0 && newQ) {
                  const { data: cats } = await supabase
                    .from("categories")
                    .select("id")
                    .in("name", catNames);

                  if (cats && cats.length > 0) {
                    await supabase.from("question_categories").insert(
                      cats.map((c) => ({
                        question_id: newQ.id,
                        category_id: c.id,
                      })),
                    );
                  }
                }

                controller.enqueue(
                  encoder.encode(
                    sseEvent("done", {
                      question_id: newQ?.id,
                      title: followUp.title,
                      full_text: fullText,
                    }),
                  ),
                );
              } catch (parseErr) {
                controller.enqueue(
                  encoder.encode(
                    sseEvent("done", {
                      full_text: fullText,
                      parse_error: String(parseErr),
                    }),
                  ),
                );
              }
              controller.close();
              break;
            }
            case "error":
              controller.enqueue(encoder.encode(sseEvent("error", { message: event.message })));
              controller.close();
              break;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        controller.enqueue(encoder.encode(sseEvent("error", { message })));
        controller.close();
      }
    },
    cancel() {
      childProcess.kill("SIGTERM");
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
