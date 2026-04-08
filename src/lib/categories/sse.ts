/**
 * 카테고리 생성 API용 SSE 스트림 헬퍼
 */
export function createSSEStream() {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController | null = null;

  const stream = new ReadableStream({
    start(c) {
      controller = c;
    },
  });

  function send(data: Record<string, unknown>) {
    controller?.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  }

  function close() {
    controller?.close();
  }

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });

  return { send, close, response };
}
