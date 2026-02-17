/**
 * Server-side SSE response builder.
 * Provides a simple callback API for emitting SSE events from API routes.
 */

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

/**
 * Create an SSE Response from an async callback.
 *
 * Usage:
 *   return createSSEResponse(async (enqueue) => {
 *     enqueue({ type: "chunk", text: "..." });
 *     enqueue({ type: "done" });
 *   });
 */
export function createSSEResponse(
  handler: (enqueue: (data: Record<string, unknown>) => void) => Promise<void>,
): Response {
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      const enqueue = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // Controller closed (client disconnected)
        }
      };

      try {
        await handler(enqueue);
      } catch (error) {
        console.error("SSE stream error:", error);
        enqueue({ type: "error", message: "Stream failed" });
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed
        }
      }
    },
  });

  return new Response(readable, { headers: SSE_HEADERS });
}
