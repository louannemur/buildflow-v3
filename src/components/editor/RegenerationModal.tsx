"use client";

import { useState, useCallback } from "react";
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
  ArrowRight,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────────────────────── */

type Step = "choose" | "new-style";

export interface RegenerateConfig {
  useStyleGuide: boolean;
  stylePrompt?: string;
}

interface RegenerationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isStyleGuide: boolean;
  onRegenerate: (config: RegenerateConfig) => void;
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function RegenerationModal({
  open,
  onOpenChange,
  isStyleGuide,
  onRegenerate,
}: RegenerationModalProps) {
  const [step, setStep] = useState<Step>("choose");
  const [stylePrompt, setStylePrompt] = useState("");

  // Wrap onOpenChange to reset state when modal closes
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        setStep("choose");
        setStylePrompt("");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange],
  );

  function handleFollowStyleGuide() {
    onRegenerate({ useStyleGuide: true });
    handleOpenChange(false);
  }

  function handleNewStyleSurprise() {
    onRegenerate({ useStyleGuide: false });
    handleOpenChange(false);
  }

  function handleNewStyleWithPrompt() {
    if (!stylePrompt.trim()) return;
    onRegenerate({ useStyleGuide: false, stylePrompt: stylePrompt.trim() });
    handleOpenChange(false);
  }

  // ─── Step 1: Choose mode ─────────────────────────────────────────

  if (step === "choose") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
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
              >
                <BookOpen className="size-4 shrink-0" />
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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
          >
            <Sparkles className="size-4" />
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
            disabled={!stylePrompt.trim()}
          >
            <ArrowRight className="size-4" />
            Generate with this style
          </Button>
        </div>

        <button
          onClick={() => setStep("choose")}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
      </DialogContent>
    </Dialog>
  );
}
