"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star, RefreshCw, Undo2, Loader2 } from "lucide-react";

interface StyleMismatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMakeStyleGuide: () => void;
  onRegenerateAgain: () => void;
  onRevert: () => void;
  isUpdatingOtherPages: boolean;
}

export function StyleMismatchModal({
  open,
  onOpenChange,
  onMakeStyleGuide,
  onRegenerateAgain,
  onRevert,
  isUpdatingOtherPages,
}: StyleMismatchModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={isUpdatingOtherPages ? undefined : onOpenChange}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isUpdatingOtherPages
              ? "Updating style guide..."
              : "This design doesn\u2019t match the style guide"}
          </DialogTitle>
          <DialogDescription>
            {isUpdatingOtherPages
              ? "Regenerating other pages to match the new style guide. This may take a moment."
              : "The regenerated design uses a different style. What would you like to do?"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Button
            className="h-auto w-full justify-start gap-3 py-3"
            onClick={onMakeStyleGuide}
            disabled={isUpdatingOtherPages}
          >
            {isUpdatingOtherPages ? (
              <Loader2 className="size-4 shrink-0 animate-spin" />
            ) : (
              <Star className="size-4 shrink-0" />
            )}
            <div className="text-left">
              <div className="font-medium">Make this the new style guide</div>
              <div className="text-xs font-normal opacity-80">
                Update all other pages to match this style
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto w-full justify-start gap-3 py-3"
            onClick={onRegenerateAgain}
            disabled={isUpdatingOtherPages}
          >
            <RefreshCw className="size-4 shrink-0" />
            <div className="text-left">
              <div className="font-medium">Try a different style</div>
              <div className="text-xs text-muted-foreground">
                Regenerate this page with a new approach
              </div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="h-auto w-full justify-start gap-3 py-3"
            onClick={onRevert}
            disabled={isUpdatingOtherPages}
          >
            <Undo2 className="size-4 shrink-0" />
            <div className="text-left">
              <div className="font-medium">Revert to previous version</div>
              <div className="text-xs text-muted-foreground">
                Go back to the version that matched the style guide
              </div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
