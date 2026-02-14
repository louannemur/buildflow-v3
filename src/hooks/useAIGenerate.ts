"use client";

import { useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function useAIGenerate() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const generate = async (
    action: string,
    data: Record<string, unknown>,
  ): Promise<string | null> => {
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...data }),
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

  return {
    isGenerating,
    error,
    generate,
    editDesign,
    modifyElement,
    addSectionAfter,
    showUpgradeModal,
    setShowUpgradeModal,
  };
}
