import { NextRequest, NextResponse } from "next/server";
import { cliAgentMap } from "@/lib/agents";
import type { MissionType } from "@/lib/agents";
import { spawnClaude, parseStreamOutput, buildEvalPrompt } from "@/lib/evaluate/claude-runner";

interface EvaluateRequest {
  mission_id: string;
  mission_type: MissionType;
  question: string;
  answer: string;
  category_name: string;
  code_snippet?: string;
  attempt_number: number;
  session_id?: string;
  agent_override?: string;
}

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: EvaluateRequest;
  try {
    body = (await req.json()) as EvaluateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    mission_type,
    question,
    answer,
    category_name,
    code_snippet,
    attempt_number,
    session_id,
    agent_override,
  } = body;

  if (!mission_type || !question || !answer || !category_name || !attempt_number) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const agentName = agent_override ?? cliAgentMap[mission_type];
  if (!agentName) {
    return NextResponse.json({ error: `Unknown mission type: ${mission_type}` }, { status: 400 });
  }

  const prompt = buildEvalPrompt({
    question,
    answer,
    categoryName: category_name,
    attemptNumber: session_id ? attempt_number : 1,
    codeSnippet: code_snippet,
  });

  const childProcess = spawnClaude({
    agentName,
    prompt,
    sessionId: session_id,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of parseStreamOutput(childProcess)) {
          switch (event.type) {
            case "text":
              controller.enqueue(encoder.encode(sseEvent("text", { content: event.content })));
              break;
            case "session":
              controller.enqueue(
                encoder.encode(sseEvent("session", { session_id: event.sessionId })),
              );
              break;
            case "done":
              controller.enqueue(
                encoder.encode(
                  sseEvent("done", {
                    full_text: event.fullText,
                    session_id: event.sessionId,
                  }),
                ),
              );
              controller.close();
              break;
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
