/**
 * Client-side SSE stream reader.
 * Reads a fetch Response body and dispatches parsed SSE events.
 */

export interface SSEReaderOptions {
  /** Called for each parsed event object */
  onEvent: (event: Record<string, unknown>) => void;
  /** Called when the stream ends */
  onDone?: () => void;
  /** Called on error */
  onError?: (error: Error) => void;
}

/**
 * Read an SSE response body and dispatch parsed events.
 * Returns a promise that resolves when the stream ends.
 */
export async function readSSEStream(
  response: Response,
  options: SSEReaderOptions,
): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const parsed = JSON.parse(jsonStr);

          if (parsed.type === "error") {
            options.onError?.(
              new Error(
                (parsed.message as string) || "Stream error",
              ),
            );
            return;
          }

          options.onEvent(parsed);

          if (parsed.type === "done") {
            options.onDone?.();
            return;
          }
        } catch {
          // Skip malformed JSON lines
          continue;
        }
      }
    }
    options.onDone?.();
  } catch (err) {
    options.onError?.(
      err instanceof Error ? err : new Error("Stream read failed"),
    );
  }
}
