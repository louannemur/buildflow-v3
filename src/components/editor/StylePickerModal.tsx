"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Wand2 } from "lucide-react";

/* ─── Props ───────────────────────────────────────────────────────────────── */

interface StylePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: "surprise" | string) => void;
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export function StylePickerModal({
  open,
  onOpenChange,
  onGenerate,
}: StylePickerModalProps) {
  const [prompt, setPrompt] = React.useState("");

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setPrompt("");
    }
  }, [open]);

  const handleGenerate = () => {
    if (!prompt.trim()) return;
    onGenerate(prompt.trim());
    onOpenChange(false);
  };

  const handleSurprise = () => {
    onGenerate("surprise");
    onOpenChange(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && prompt.trim()) {
      e.preventDefault();
      handleGenerate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Design</DialogTitle>
        </DialogHeader>

        {/* Prompt input */}
        <Textarea
          placeholder="Describe your design... e.g. A modern SaaS landing page with a dark theme and gradient accents"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          className="min-h-[100px] resize-none text-sm"
          autoFocus
        />

        {/* Generate button */}
        <Button
          className="w-full gap-2"
          onClick={handleGenerate}
          disabled={!prompt.trim()}
        >
          <Wand2 className="size-4" />
          Generate Design
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">OR</span>
          </div>
        </div>

        {/* Surprise Me */}
        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={handleSurprise}
        >
          <Sparkles className="size-4" />
          Surprise me
        </Button>
      </DialogContent>
    </Dialog>
  );
}
