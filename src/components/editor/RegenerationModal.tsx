"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Paintbrush,
  BookOpen,
  RefreshCw,
  Undo2,
  ArrowRight,
  Loader2,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Step = "choose" | "new-style" | "post-gen";

interface RegenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  pageId: string;
  designId: string;
  isStyleGuide: boolean;
  /** Called with new HTML after regeneration completes */
  onRegenerationComplete: (html: string) => void;
  /** Called when user wants to revert to previous HTML */
  onRevert: (previousHtml: string) => void;
  /** Called when user wants to update all other designs to match */
  onUpdateAll: (newStyleGuideDesignId: string) => void;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function RegenerationModal({
  open,
  onOpenChange,
  projectId,
  pageId,
  designId,
  isStyleGuide,
  onRegenerationComplete,
  onRevert,
  onUpdateAll,
}: RegenerationModalProps) {
  const [step, setStep] = useState<Step>("choose");
  const [stylePrompt, setStylePrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [previousHtml, setPreviousHtml] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("choose");
      setStylePrompt("");
      setLoading(false);
      setPreviousHtml(null);
    }
  }, [open]);

  async function regenerate(opts: {
    useStyleGuide: boolean;
    stylePrompt?: string;
  }) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/designs/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId,
            forceRegenerate: true,
            useStyleGuide: opts.useStyleGuide,
            stylePrompt: opts.stylePrompt,
            skipReview: false,
          }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Generation failed");
      }

      const data = await res.json();

      // Store previous HTML for revert (the API saved a version snapshot)
      // We need to fetch the previous version from the version history
      setPreviousHtml(data.previousHtml ?? null);

      onRegenerationComplete(data.html);
      setStep("post-gen");
    } catch (err) {
      console.error("Regeneration failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleFollowStyleGuide() {
    regenerate({ useStyleGuide: true });
  }

  function handleNewStyleSurprise() {
    regenerate({ useStyleGuide: false });
  }

  function handleNewStyleWithPrompt() {
    if (!stylePrompt.trim()) return;
    regenerate({ useStyleGuide: false, stylePrompt: stylePrompt.trim() });
  }

  function handleRevert() {
    if (previousHtml) {
      onRevert(previousHtml);
    }
    onOpenChange(false);
  }

  async function handleUpdateAll() {
    // Set this design as the style guide
    await fetch(`/api/designs/${designId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isStyleGuide: true }),
    });

    onUpdateAll(designId);
    onOpenChange(false);
  }

  function handleTryAnother() {
    setStep("choose");
    setStylePrompt("");
  }

  // ─── Step 1: Choose mode ─────────────────────────────────────────

  if (step === "choose") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Regenerate Design</DialogTitle>
            <DialogDescription>
              How would you like to regenerate this page?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {!isStyleGuide && (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={handleFollowStyleGuide}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="size-4 shrink-0 animate-spin" />
                ) : (
                  <BookOpen className="size-4 shrink-0" />
                )}
                <div className="text-left">
                  <div className="font-medium">Follow style guide</div>
                  <div className="text-xs text-muted-foreground">
                    Regenerate using the current style guide
                  </div>
                </div>
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={() => setStep("new-style")}
              disabled={loading}
            >
              <Paintbrush className="size-4 shrink-0" />
              <div className="text-left">
                <div className="font-medium">New style</div>
                <div className="text-xs text-muted-foreground">
                  Try a completely different look
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Step 2: New style options ───────────────────────────────────

  if (step === "new-style") {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Style</DialogTitle>
            <DialogDescription>
              Describe the style you want, or let us surprise you.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-center gap-2"
              onClick={handleNewStyleSurprise}
              disabled={loading}
            >
              {loading && !stylePrompt.trim() ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Surprise me
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Textarea
              placeholder="e.g. Minimalist dark theme with a single neon accent color, editorial typography..."
              value={stylePrompt}
              onChange={(e) => setStylePrompt(e.target.value)}
              className="min-h-[80px] resize-none text-sm"
            />

            <Button
              className="w-full gap-2"
              onClick={handleNewStyleWithPrompt}
              disabled={loading || !stylePrompt.trim()}
            >
              {loading && stylePrompt.trim() ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Generate with this style
            </Button>
          </div>

          <button
            onClick={() => setStep("choose")}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            disabled={loading}
          >
            Back
          </button>
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Step 3: Post-generation ─────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Design regenerated</DialogTitle>
          <DialogDescription>
            What would you like to do next?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleUpdateAll}
          >
            <RefreshCw className="size-4 shrink-0" />
            <div className="text-left">
              <div className="font-medium">Update all designs to match</div>
              <div className="text-xs text-muted-foreground">
                Set this as the style guide and regenerate other pages
              </div>
            </div>
          </Button>

          {previousHtml && (
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-3"
              onClick={handleRevert}
            >
              <Undo2 className="size-4 shrink-0" />
              <div className="text-left">
                <div className="font-medium">Revert to previous</div>
                <div className="text-xs text-muted-foreground">
                  Restore the design before regeneration
                </div>
              </div>
            </Button>
          )}

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleTryAnother}
          >
            <Sparkles className="size-4 shrink-0" />
            <div className="text-left">
              <div className="font-medium">Try another style</div>
              <div className="text-xs text-muted-foreground">
                Regenerate with a different approach
              </div>
            </div>
          </Button>
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => onOpenChange(false)}
        >
          Keep current design and close
        </Button>
      </DialogContent>
    </Dialog>
  );
}
