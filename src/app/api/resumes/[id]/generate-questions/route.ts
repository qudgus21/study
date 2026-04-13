import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { spawnClaude, parseStreamOutput } from "@/lib/evaluate/claude-runner";

type Params = { params: Promise<{ id: string }> };

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;

  // 이력서 조회
  const { data: resume, error } = await supabase.from("resumes").select("*").eq("id", id).single();

  if (error || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  const parsedSections = resume.parsed_sections as Record<string, unknown> | null;
  const resumeInfo = parsedSections
    ? JSON.stringify(parsedSections, null, 2)
    : (resume.extracted_text?.slice(0, 6000) ?? "이력서 내용 없음");

  // 카테고리 목록 조회
  const { data: categories } = await supabase
    .from("categories")
    .select("name")
    .eq("is_default", true)
    .order("display_order");

  const categoryList = (categories ?? []).map((c) => c.name).join(", ");

  // 기존 질문 목록 (중복 방지)
  const { data: existingQ } = await supabase.from("questions").select("title").limit(200);
  const existingTitles = (existingQ ?? []).map((q) => q.title).join("\n- ");

  let body: { count?: number } = {};
  try {
    body = (await req.json()) as { count?: number };
  } catch {
    // empty body ok
  }
  const count = body.count ?? 15;

  const prompt = `당신은 프론트엔드 기술면접관입니다.
아래 이력서를 분석하여 이 지원자에게 물어볼 면접 질문을 ${count}개 생성하세요.

## 이력서 정보
${resumeInfo}

## 생성 원칙
- 이력서에 기재된 기술 스택의 심화 질문
  예: "React를 주력으로 사용하셨는데, Fiber 아키텍처에 대해 설명해주세요"
- 프로젝트 경험 기반 질문 (구체적 프로젝트명 언급)
  예: "XX 프로젝트에서 성능 최적화를 하셨다고 했는데, 구체적으로 어떤 지표를 개선했나요?"
- 기술 선택 이유 질문
  예: "상태관리로 XX를 선택하신 이유는?"
- 경력에서 드러나는 리더십/협업 경험 질문
- 이력서에 없는 영역에서의 기본 질문도 1-2개 포함 (약점 파악용)

## 질문 형태 다양화
- 개념형: "~에 대해 설명해주세요"
- 시나리오형: "이런 상황이라면 어떻게 하시겠어요?"
- 경험형: "~한 경험이 있으신가요? 구체적으로 말씀해주세요"
- 설계형: "~를 설계한다면 어떻게 접근하시겠어요?"

## 카테고리 목록 (태깅용)
${categoryList}

## 기존 질문 (중복 방지)
- ${existingTitles || "없음"}

## 출력 형식
반드시 아래 JSON 배열만 출력하세요.
\`\`\`json
[
  {
    "title": "질문 내용",
    "description": "질문 의도 및 기대 답변 수준 (2-3문장)",
    "difficulty": "junior|mid|senior",
    "categories": ["카테고리1", "카테고리2"],
    "reference_content": "## 상세 해설\\n(500자 내외 해설)\\n## 핵심 개념\\n- 개념1: 설명"
  }
]
\`\`\`

IMPORTANT: 반드시 한국어로 응답하세요.`;

  const childProcess = spawnClaude({
    agentName: "follow-up-generator",
    prompt,
    timeoutMs: 180_000,
    allowedTools: ["WebSearch"],
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

                let savedCount = 0;
                for (const q of questions) {
                  const { data: newQ, error: qError } = await supabase
                    .from("questions")
                    .insert({
                      title: q.title,
                      description: q.description ?? null,
                      reference_content: q.reference_content ?? null,
                      difficulty: q.difficulty ?? "mid",
                      source_type: "resume",
                      source_ref: id,
                      status: "pending",
                    })
                    .select("id")
                    .single();

                  if (qError || !newQ) continue;

                  // 카테고리 연결
                  const catNames = q.categories ?? [];
                  if (catNames.length > 0) {
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
                  savedCount++;
                }

                controller.enqueue(
                  encoder.encode(
                    sseEvent("done", {
                      saved_count: savedCount,
                      total_generated: questions.length,
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
