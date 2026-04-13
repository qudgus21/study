import { spawn, type ChildProcess } from "child_process";

export interface StreamEvent {
  type: "text" | "session" | "done" | "error" | "tool_use";
  content?: string;
  sessionId?: string;
  fullText?: string;
  message?: string;
  toolName?: string;
}

interface RunnerOptions {
  agentName: string;
  prompt: string;
  sessionId?: string;
  cwd?: string;
  timeoutMs?: number;
  allowedTools?: string[];
}

const CLAUDE_BIN = "claude";
const DEFAULT_TIMEOUT_MS = 120_000;

function sanitizeEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING;
  return env;
}

function buildArgs(options: RunnerOptions): string[] {
  const args = [
    "--print",
    "--output-format",
    "stream-json",
    "--verbose",
    "--permission-mode",
    "bypassPermissions",
    "--include-partial-messages",
    "-p",
    options.prompt,
  ];

  if (options.allowedTools?.length) {
    for (const tool of options.allowedTools) {
      args.push("--allowedTools", tool);
    }
  }

  if (options.sessionId) {
    args.unshift("--resume", options.sessionId);
  } else {
    args.unshift("--agent", options.agentName);
  }

  return args;
}

/**
 * stdout의 stream-json 출력을 파싱하여 StreamEvent를 yield한다.
 * 각 줄은 독립된 JSON 객체이며, type 필드로 구분한다.
 */
export async function* parseStreamOutput(
  process: ChildProcess,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): AsyncGenerator<StreamEvent> {
  const stdout = process.stdout;
  if (!stdout) {
    yield { type: "error", message: "stdout not available" };
    return;
  }

  let fullText = "";
  let sessionId: string | null = null;
  let buffer = "";

  const timeoutPromise = new Promise<"timeout">((resolve) =>
    setTimeout(() => resolve("timeout"), timeoutMs),
  );

  const chunks: string[] = [];
  let resolveChunk: (() => void) | null = null;
  let done = false;

  stdout.setEncoding("utf-8");
  stdout.on("data", (data: string) => {
    chunks.push(data);
    resolveChunk?.();
  });

  process.on("close", () => {
    done = true;
    resolveChunk?.();
  });

  process.stderr?.on("data", (data: string) => {
    const msg = data.toString().trim();
    if (msg) {
      console.warn("[claude-runner stderr]", msg);
    }
  });

  while (true) {
    if (chunks.length === 0 && !done) {
      const result = await Promise.race([
        new Promise<"chunk">((resolve) => {
          resolveChunk = () => resolve("chunk");
        }),
        timeoutPromise,
      ]);

      if (result === "timeout") {
        process.kill("SIGTERM");
        yield {
          type: "error",
          message: `평가 시간이 초과되었습니다 (${Math.round(timeoutMs / 1000)}초)`,
        };
        if (fullText) {
          yield { type: "done", fullText, sessionId: sessionId ?? undefined };
        }
        return;
      }
    }

    if (chunks.length === 0 && done) break;

    while (chunks.length > 0) {
      buffer += chunks.shift()!;
    }

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const json = JSON.parse(trimmed);

        if (json.type === "assistant" && json.message?.content) {
          for (const block of json.message.content) {
            if (block.type === "text" && block.text) {
              fullText += block.text;
              yield { type: "text", content: block.text };
            }
            if (block.type === "tool_use" && block.name) {
              yield { type: "tool_use", toolName: block.name };
            }
          }
        }

        if (json.type === "result" && json.session_id) {
          sessionId = json.session_id;
          yield { type: "session", sessionId: sessionId ?? undefined };
        }
      } catch {
        // 파싱 불가능한 줄은 무시
      }
    }
  }

  // 버퍼에 남은 데이터 처리
  if (buffer.trim()) {
    try {
      const json = JSON.parse(buffer.trim());
      if (json.type === "result" && json.session_id) {
        sessionId = json.session_id;
        yield { type: "session", sessionId: sessionId ?? undefined };
      }
    } catch {
      // 무시
    }
  }

  yield { type: "done", fullText, sessionId: sessionId ?? undefined };
}

export function spawnClaude(options: RunnerOptions): ChildProcess {
  const args = buildArgs(options);
  const cwd = options.cwd ?? process.cwd();
  const env = sanitizeEnv();

  console.log("[claude-runner] spawn:", CLAUDE_BIN, args.slice(0, 4).join(" "), "...");
  console.log("[claude-runner] cwd:", cwd);
  console.log("[claude-runner] CLAUDECODE env:", env.CLAUDECODE ?? "(unset)");

  const proc = spawn(CLAUDE_BIN, args, {
    env,
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.on("error", (err) => {
    console.error("[claude-runner] spawn error:", err.message);
  });

  proc.on("close", (code) => {
    console.log("[claude-runner] process exited with code:", code);
  });

  return proc;
}

export function buildEvalPrompt(params: {
  questionTitle: string;
  questionDescription?: string;
  answer: string;
  categoryNames: string[];
  attemptNumber: number;
  codeSnippet?: string;
}): string {
  if (params.attemptNumber > 1) {
    return [
      `## 재시도 답변 (시도 #${params.attemptNumber})`,
      params.answer,
      "",
      "이전 피드백을 참고하여 개선된 부분을 확인하고, 동일한 루브릭으로 재평가해주세요.",
    ].join("\n");
  }

  const parts = [
    `## 질문`,
    params.questionTitle,
    ...(params.questionDescription ? [`\n${params.questionDescription}`] : []),
    "",
    `## 카테고리`,
    params.categoryNames.join(", ") || "일반",
    "",
    `## 답변 (시도 #1)`,
    params.answer,
  ];

  if (params.codeSnippet) {
    parts.push("", "## 코드 스니펫", "```", params.codeSnippet, "```");
  }

  parts.push("", "위 답변을 평가해주세요.");
  return parts.join("\n");
}

export function buildFollowUpPrompt(params: {
  originalQuestion: string;
  userAnswer: string;
  score: number;
  feedbackSummary: string;
  categoryNames: string[];
}): string {
  return [
    `## 원래 질문`,
    params.originalQuestion,
    "",
    `## 카테고리`,
    params.categoryNames.join(", ") || "일반",
    "",
    `## 지원자 답변`,
    params.userAnswer,
    "",
    `## 평가 결과 요약`,
    `점수: ${params.score}/100`,
    params.feedbackSummary,
    "",
    "위 맥락을 바탕으로 자연스러운 꼬리질문 1개를 JSON 형식으로 생성해주세요.",
  ].join("\n");
}
