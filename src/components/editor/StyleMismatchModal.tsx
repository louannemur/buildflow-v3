"use client";

import { Button } from "@/components/ui/button";
import { Star, RefreshCw, Undo2, Loader2 } from "lucide-react";

interface StyleMismatchBarProps {
  visible: boolean;
  onMakeStyleGuide: () => void;
  onRegenerateAgain: () => void;
  onRevert: () => void;
  isUpdatingOtherPages: boolean;
}

export function StyleMismatchBar({
  visible,
  onMakeStyleGuide,
  onRegenerateAgain,
  onRevert,
  isUpdatingOtherPages,
}: StyleMismatchBarProps) {
  if (!visible) return null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <p className="shrink-0 text-sm font-medium text-foreground">
          {isUpdatingOtherPages
            ? "Updating other pages..."
            : "This design doesn\u2019t match the style guide"}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            onClick={onMakeStyleGuide}
            disabled={isUpdatingOtherPages}
            className="gap-1.5"
          >
            {isUpdatingOtherPages ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Star className="size-3.5" />
            )}
            Make style guide
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onRegenerateAgain}
            disabled={isUpdatingOtherPages}
            className="gap-1.5"
          >
            <RefreshCw className="size-3.5" />
            Try different style
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onRevert}
            disabled={isUpdatingOtherPages}
            className="gap-1.5"
          >
            <Undo2 className="size-3.5" />
            Revert
          </Button>
        </div>
      </div>
    </div>
  );
}
