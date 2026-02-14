"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, Sparkles, Wand2 } from "lucide-react";

/* ─── Types ────────────────────────────────────────────────────────────────── */

export interface GenerateConfig {
  colorScheme: ColorScheme;
  customColors: { primary: string; secondary: string; accent: string };
  style: DesignStyle;
  animations: boolean;
  animationType: AnimationType;
  instructions: string;
}

type ColorScheme = "vibrant" | "muted" | "dark" | "pastel" | "monochrome" | "custom";
type DesignStyle = "modern" | "bold" | "soft" | "corporate" | "playful";
type AnimationType = "fade" | "slide" | "scale" | "parallax";

interface StylePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (config: GenerateConfig | "surprise") => void;
}

/* ─── Preset data ──────────────────────────────────────────────────────────── */

const COLOR_SCHEMES: {
  key: ColorScheme;
  label: string;
  colors: string[];
}[] = [
  { key: "vibrant", label: "Vibrant", colors: ["#6d28d9", "#f59e0b", "#ec4899", "#10b981"] },
  { key: "muted", label: "Muted", colors: ["#94a3b8", "#a78bfa", "#d1d5db", "#e2e8f0"] },
  { key: "dark", label: "Dark", colors: ["#0a0a0a", "#1e1e2e", "#6d28d9", "#f8fafc"] },
  { key: "pastel", label: "Pastel", colors: ["#fce7f3", "#dbeafe", "#dcfce7", "#fef3c7"] },
  { key: "monochrome", label: "Monochrome", colors: ["#171717", "#525252", "#a3a3a3", "#f5f5f5"] },
];

const STYLE_OPTIONS: { key: DesignStyle; label: string }[] = [
  { key: "modern", label: "Modern / Minimal" },
  { key: "bold", label: "Bold / Striking" },
  { key: "soft", label: "Soft / Organic" },
  { key: "corporate", label: "Corporate / Professional" },
  { key: "playful", label: "Playful / Creative" },
];

const ANIMATION_OPTIONS: { key: AnimationType; label: string }[] = [
  { key: "fade", label: "Fade in" },
  { key: "slide", label: "Slide up" },
  { key: "scale", label: "Scale" },
  { key: "parallax", label: "Parallax" },
];

/* ─── Default config ───────────────────────────────────────────────────────── */

const DEFAULT_CONFIG: GenerateConfig = {
  colorScheme: "vibrant",
  customColors: { primary: "#6d28d9", secondary: "#f59e0b", accent: "#ec4899" },
  style: "modern",
  animations: true,
  animationType: "fade",
  instructions: "",
};

/* ─── Component ────────────────────────────────────────────────────────────── */

export function StylePickerModal({
  open,
  onOpenChange,
  onGenerate,
}: StylePickerModalProps) {
  const [showCustomize, setShowCustomize] = React.useState(false);
  const [config, setConfig] = React.useState<GenerateConfig>(DEFAULT_CONFIG);

  // Reset state when modal opens
  React.useEffect(() => {
    if (open) {
      setShowCustomize(false);
      setConfig(DEFAULT_CONFIG);
    }
  }, [open]);

  const update = <K extends keyof GenerateConfig>(
    key: K,
    value: GenerateConfig[K],
  ) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSurprise = () => {
    onGenerate("surprise");
    onOpenChange(false);
  };

  const handleGenerate = () => {
    onGenerate(config);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Generate Design</DialogTitle>
        </DialogHeader>

        {/* Surprise Me */}
        <Button
          variant="outline"
          className="w-full justify-center gap-2"
          onClick={handleSurprise}
        >
          <Sparkles className="size-4" />
          Surprise me
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border/60" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-background px-2 text-muted-foreground">or</span>
          </div>
        </div>

        {/* Customize toggle */}
        <button
          className="flex w-full items-center justify-between rounded-md border border-border/60 px-3 py-2.5 text-sm font-medium transition-colors hover:bg-muted/50"
          onClick={() => setShowCustomize(!showCustomize)}
        >
          <span>Customize</span>
          <ChevronDown
            className={`size-4 text-muted-foreground transition-transform ${
              showCustomize ? "rotate-180" : ""
            }`}
          />
        </button>

        {/* Customization panel */}
        {showCustomize && (
          <div className="space-y-5 rounded-lg border border-border/60 bg-muted/20 p-4">
            {/* Color Scheme */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Color Scheme</Label>
              <div className="flex flex-wrap gap-2">
                {COLOR_SCHEMES.map((scheme) => (
                  <button
                    key={scheme.key}
                    className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-all ${
                      config.colorScheme === scheme.key
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border/60 hover:border-primary/40"
                    }`}
                    onClick={() => update("colorScheme", scheme.key)}
                  >
                    <span className="flex gap-0.5">
                      {scheme.colors.map((c, i) => (
                        <span
                          key={i}
                          className="size-3 rounded-full"
                          style={{ background: c }}
                        />
                      ))}
                    </span>
                    <span>{scheme.label}</span>
                  </button>
                ))}
                <button
                  className={`rounded-md border px-2.5 py-1.5 text-xs transition-all ${
                    config.colorScheme === "custom"
                      ? "border-primary bg-primary/5 font-medium"
                      : "border-border/60 hover:border-primary/40"
                  }`}
                  onClick={() => update("colorScheme", "custom")}
                >
                  Custom
                </button>
              </div>

              {/* Custom color inputs */}
              {config.colorScheme === "custom" && (
                <div className="flex gap-3 pt-1">
                  {(["primary", "secondary", "accent"] as const).map((key) => (
                    <div key={key} className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={config.customColors[key]}
                        onChange={(e) =>
                          update("customColors", {
                            ...config.customColors,
                            [key]: e.target.value,
                          })
                        }
                        className="size-6 cursor-pointer rounded border border-border/60 bg-transparent p-0"
                      />
                      <span className="text-[11px] capitalize text-muted-foreground">
                        {key}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Style */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">Style</Label>
              <Select
                value={config.style}
                onValueChange={(v) => update("style", v as DesignStyle)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.key} value={opt.key} className="text-xs">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Animations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Animations</Label>
                <Switch
                  checked={config.animations}
                  onCheckedChange={(v) => update("animations", v)}
                />
              </div>
              {config.animations && (
                <Select
                  value={config.animationType}
                  onValueChange={(v) =>
                    update("animationType", v as AnimationType)
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ANIMATION_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.key}
                        value={opt.key}
                        className="text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Additional instructions */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Additional Instructions
              </Label>
              <Textarea
                placeholder="Describe any specific requirements..."
                value={config.instructions}
                onChange={(e) => update("instructions", e.target.value)}
                className="min-h-[72px] resize-none text-xs"
              />
            </div>
          </div>
        )}

        {/* Generate button */}
        <Button className="w-full gap-2" onClick={handleGenerate}>
          <Wand2 className="size-4" />
          Generate
        </Button>
      </DialogContent>
    </Dialog>
  );
}
