"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DESIGN_ARCHETYPES,
  ARCHETYPE_KEYS,
  getRandomArchetype,
} from "@/lib/design/design-archetypes";
import type { DesignArchetype } from "@/lib/design/design-archetypes";

interface StylePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (archetype: DesignArchetype) => void;
}

export function StylePickerModal({ open, onOpenChange, onSelect }: StylePickerModalProps) {
  const [selected, setSelected] = React.useState<DesignArchetype | null>(null);

  const handleSurprise = () => {
    const archetype = getRandomArchetype();
    onSelect(archetype);
    onOpenChange(false);
  };

  const handleGenerate = () => {
    if (selected) {
      onSelect(selected);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a design style</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {ARCHETYPE_KEYS.map((key) => {
            const archetype = DESIGN_ARCHETYPES[key];
            const isSelected = selected === key;

            return (
              <button
                key={key}
                className={`flex flex-col items-center gap-2 rounded-lg border p-3 text-center transition-all hover:border-primary/40 ${
                  isSelected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border/60"
                }`}
                onClick={() => setSelected(key)}
              >
                <div className="flex gap-1">
                  {archetype.previewColors.map((color, i) => (
                    <span
                      key={i}
                      className="size-4 rounded-full"
                      style={{ background: color }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium">{archetype.label}</span>
                <span className="text-[10px] text-muted-foreground leading-tight">{archetype.description}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" size="sm" onClick={handleSurprise}>
            Surprise me
          </Button>
          <Button size="sm" onClick={handleGenerate} disabled={!selected}>
            Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
