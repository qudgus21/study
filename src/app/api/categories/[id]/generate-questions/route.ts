import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";

type Params = { params: Promise<{ id: string }> };

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  // 카테고리 조회
  const { data: category, error: catError } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .single();

  if (catError || !category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  let body: { count?: number } = {};
  try {
    body = (await req.json()) as { count?: number };
  } catch {
    // empty body ok
  }
  const count = body.count ?? 5;

  // 기존 질문 목록 (중복 방지)
  const { data: existingQ } = await supabase.from("questions").select("title").limit(500);
  const existingTitles = (existingQ ?? []).map((q) => q.title as string).join("\n- ");

  const prompt = `당신은 프론트엔드 기술면접 출제위원입니다.
"${category.name}" 카테고리에서 면접 질문 ${count}개를 생성하세요.

## 카테고리 정보
- 이름: ${category.name}
- 설명: ${category.description ?? ""}

## 생성 규칙
- 실제 면접 빈도 높은 질문 우선
- 개념형("~에 대해 설명해주세요") / 시나리오형("이런 경우 어떻게?") / 경험형("~한 경험이 있나요?") 다양하게
- 난이도(junior/mid/senior) 골고루
- 카테고리에 억지로 끼워맞추지 말 것. 자연스러운 질문만 생성
- 생성된 질문이 다른 카테고리에도 해당되면 함께 태깅

## 기존 질문 (중복 방지)
- ${existingTitles || "없음"}

## 출력 형식
서두 없이 바로 JSON 배열만 출력하세요.
\`\`\`json
[
  {
    "title": "질문 내용",
    "description": "질문 의도 및 기대 답변 수준 (2-3문장)",
    "difficulty": "junior|mid|senior",
    "categories": ["${category.name}"],
    "reference_content": "## 상세 해설\\n(1000자 내외 한글 해설)\\n## 핵심 개념\\n- 개념1: 설명\\n- 개념2: 설명"
  }
]
\`\`\`

IMPORTANT: 반드시 한국어로 응답하세요.`;

  const childProcess = spawnClaude({
    agentName: "follow-up-generator",
    prompt,
    timeoutMs: 180_000,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = "";
      try {
        for await (const event of parseStreamOutput(childProcess, 180_000)) {
          switch (event.type) {
            case "text":
              fullText += event.content ?? "";
              controller.enqueue(encoder.encode(sseEvent("text", { content: event.content })));
              break;
            case "done": {
              try {
                const jsonMatch =
                  fullText.match(/```json\s*([\s\S]*?)\s*```/) ||
                  fullText.match(/\[[\s\S]*"title"[\s\S]*\]/);
                const jsonStr = jsonMatch?.[1] ?? jsonMatch?.[0] ?? fullText;
                const questions = JSON.parse(jsonStr) as Array<{
                  title: string;
                  description?: string;
                  difficulty?: string;
                  categories?: string[];
                  reference_content?: string;
                }>;

                controller.enqueue(
                  encoder.encode(
                    sseEvent("done", {
                      questions,
                      category_id: id,
                      category_name: category.name,
                    }),
                  ),
                );
              } catch (parseErr) {
                controller.enqueue(
                  encoder.encode(
                    sseEvent("done", {
                      questions: [],
                      parse_error: String(parseErr),
                      full_text: fullText,
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
