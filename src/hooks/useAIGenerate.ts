"use client";

import { useState, useCallback, useRef } from "react";
import { useEditorStore } from "@/lib/editor/store";
import { extractHtmlFromResponse } from "@/lib/ai/extract-code";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export type StreamPhase = "idle" | "streaming" | "rendering";

export function useAIGenerate() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [streamPhase, setStreamPhase] = useState<StreamPhase>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const onStreamChunkRef = useRef<((chunk: string, accumulated: string) => void) | null>(null);

  /* ─── Non-streaming generate (kept for backward compat) ────── */

  const generate = async (
    action: string,
    data: Record<string, unknown>,
  ): Promise<string | null> => {
    setIsGenerating(true);
    setError(null);

    const designId = useEditorStore.getState().designId;

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, designId, ...data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 429 && errorData.code === "LIMIT_REACHED") {
          setShowUpgradeModal(true);
          setIsGenerating(false);
          return null;
        }
        throw new Error(errorData.error || "Generation failed");
      }

      const result = await response.json();
      return result.code ?? null;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Generation failed";
      setError(errorMessage);
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  /* ─── Streaming generate ───────────────────────────────────── */

  const generateStream = useCallback(
    async (
      action: string,
      data: Record<string, unknown>,
    ): Promise<string | null> => {
      setIsGenerating(true);
      setError(null);
      setStreamPhase("streaming");

      const designId = useEditorStore.getState().designId;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/ai/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, designId, ...data }),
          signal: controller.signal,
        });

        if (!response.ok) {
          // Try to parse SSE error from body
          const text = await response.text();
          try {
            const match = text.match(/data:\s*(\{.*\})/);
            if (match) {
              const parsed = JSON.parse(match[1]);
              if (response.status === 429 && parsed.code === "LIMIT_REACHED") {
                setShowUpgradeModal(true);
                setStreamPhase("idle");
                setIsGenerating(false);
                return null;
              }
              throw new Error(parsed.error || "Generation failed");
            }
          } catch {
            // Fall through
          }
          throw new Error("Generation failed");
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Process complete SSE lines
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);

              if (parsed.error) {
                throw new Error(parsed.error);
              }

              if (parsed.done) {
                // Stream complete — extract code
                setStreamPhase("rendering");
                const code = extractHtmlFromResponse(accumulated);
                setIsGenerating(false);
                setStreamPhase("idle");
                return code;
              }

              if (parsed.text) {
                accumulated += parsed.text;
                onStreamChunkRef.current?.(parsed.text, accumulated);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== "Generation failed") {
                // JSON parse error, skip
                continue;
              }
              throw e;
            }
          }
        }

        // If we exit the loop without a done signal, try to extract what we have
        if (accumulated) {
          setStreamPhase("rendering");
          const code = extractHtmlFromResponse(accumulated);
          setIsGenerating(false);
          setStreamPhase("idle");
          return code;
        }

        throw new Error("Stream ended without completion");
      } catch (err) {
        if (controller.signal.aborted) {
          setStreamPhase("idle");
          setIsGenerating(false);
          return null;
        }
        const errorMessage =
          err instanceof Error ? err.message : "Generation failed";
        setError(errorMessage);
        setStreamPhase("idle");
        setIsGenerating(false);
        return null;
      }
    },
    [],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const setOnStreamChunk = useCallback(
    (cb: ((chunk: string, accumulated: string) => void) | null) => {
      onStreamChunkRef.current = cb;
    },
    [],
  );

  /* ─── Action helpers (non-streaming) ───────────────────────── */

  const editDesign = async (
    prompt: string,
    currentCode: string,
    conversationHistory?: ChatMessage[],
  ): Promise<string | null> => {
    return generate("edit-design", {
      prompt,
      currentCode,
      conversationHistory,
    });
  };

  const modifyElement = async (
    bfId: string,
    prompt: string,
    elementContext: string,
    currentCode: string,
  ): Promise<string | null> => {
    return generate("modify-element", {
      bfId,
      prompt,
      elementContext,
      currentCode,
    });
  };

  const addSectionAfter = async (
    afterBfId: string,
    prompt: string,
    currentCode: string,
  ): Promise<string | null> => {
    return generate("add-section", {
      afterBfId,
      prompt,
      currentCode,
    });
  };

  /* ─── Streaming action helpers ─────────────────────────────── */

  const generateDesignStreamAction = useCallback(
    async (
      prompt: string,
    ): Promise<string | null> => {
      return generateStream("generate-design", {
        prompt,
      });
    },
    [generateStream],
  );

  const editDesignStream = useCallback(
    async (
      prompt: string,
      currentCode: string,
      conversationHistory?: ChatMessage[],
    ): Promise<string | null> => {
      return generateStream("edit-design", {
        prompt,
        currentCode,
        conversationHistory,
      });
    },
    [generateStream],
  );

  const modifyElementStream = useCallback(
    async (
      bfId: string,
      prompt: string,
      elementContext: string,
      currentCode: string,
    ): Promise<string | null> => {
      return generateStream("modify-element", {
        bfId,
        prompt,
        elementContext,
        currentCode,
      });
    },
    [generateStream],
  );

  const addSectionAfterStream = useCallback(
    async (
      afterBfId: string,
      prompt: string,
      currentCode: string,
    ): Promise<string | null> => {
      return generateStream("add-section", {
        afterBfId,
        prompt,
        currentCode,
      });
    },
    [generateStream],
  );

  return {
    // State
    isGenerating,
    error,
    showUpgradeModal,
    setShowUpgradeModal,
    streamPhase,
    // Non-streaming
    generate,
    editDesign,
    modifyElement,
    addSectionAfter,
    // Streaming
    generateStream,
    generateDesignStreamAction,
    editDesignStream,
    modifyElementStream,
    addSectionAfterStream,
    cancelStream,
    setOnStreamChunk,
  };
}
