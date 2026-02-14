"use client";

import type { StreamPhase } from "@/hooks/useAIGenerate";

interface StreamingIndicatorProps {
  phase: StreamPhase;
  onCancel?: () => void;
}

/**
 * Lightweight floating pill that shows during design generation.
 * The actual preview is rendered live into the iframe — this just
 * shows status + cancel.
 */
export function StreamingIndicator({ phase, onCancel }: StreamingIndicatorProps) {
  if (phase === "idle") return null;

  return (
    <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-border/60 bg-background/95 px-4 py-2 shadow-lg backdrop-blur-sm">
        {/* Pulsing dot */}
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-sm font-medium text-foreground">
          {phase === "rendering" ? "Rendering..." : "Generating design..."}
        </span>
        {onCancel && phase === "streaming" && (
          <button
            onClick={onCancel}
            className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
