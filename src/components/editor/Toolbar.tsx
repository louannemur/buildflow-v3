"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  MousePointer2,
  Code2,
  Monitor,
  Tablet,
  Smartphone,
  Sparkles,
  Undo2,
  Redo2,
  Trash2,
  Star,
  FolderUp,
  Save,
  Loader2,
  Check,
  Layers,
  LayoutGrid,
  MessageSquare,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  useEditorStore,
  type EditorMode,
  type Breakpoint,
} from "@/lib/editor/store";
import { UpgradeToProjectModal } from "./toolbar/UpgradeToProjectModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/* ─── Config ─────────────────────────────────────────────────────────────── */

const MODES: { mode: EditorMode; label: string; icon: typeof Eye }[] = [
  { mode: "preview", label: "Preview", icon: Eye },
  { mode: "design", label: "Design", icon: MousePointer2 },
  { mode: "code", label: "Code", icon: Code2 },
];

const BREAKPOINTS: { bp: Breakpoint; label: string; icon: typeof Monitor }[] = [
  { bp: "desktop", label: "Desktop", icon: Monitor },
  { bp: "tablet", label: "Tablet", icon: Tablet },
  { bp: "mobile", label: "Mobile", icon: Smartphone },
];

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface ToolbarProps {
  designName: string;
  isStyleGuide: boolean;
  isProjectDesign: boolean;
  onGenerate: () => void;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Toolbar                                                                  */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function Toolbar({
  designName: initialName,
  isStyleGuide: initialIsStyleGuide,
  isProjectDesign,
  onGenerate,
}: ToolbarProps) {
  const router = useRouter();

  // ─── Store selectors ───────────────────────────────────────────────

  const mode = useEditorStore((s) => s.mode);
  const setMode = useEditorStore((s) => s.setMode);
  const breakpoint = useEditorStore((s) => s.breakpoint);
  const setBreakpoint = useEditorStore((s) => s.setBreakpoint);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const clearDesign = useEditorStore((s) => s.clearDesign);
  const undoStack = useEditorStore((s) => s.undoStack);
  const redoStack = useEditorStore((s) => s.redoStack);
  const source = useEditorStore((s) => s.source);
  const designId = useEditorStore((s) => s.designId);
  const projectId = useEditorStore((s) => s.projectId);
  const showLayers = useEditorStore((s) => s.showLayers);
  const toggleLayers = useEditorStore((s) => s.toggleLayers);
  const showComponents = useEditorStore((s) => s.showComponents);
  const toggleComponents = useEditorStore((s) => s.toggleComponents);
  const showChat = useEditorStore((s) => s.showChat);
  const toggleChat = useEditorStore((s) => s.toggleChat);

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  // ─── Local state ───────────────────────────────────────────────────

  const [name, setName] = useState(initialName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isStyleGuide, setIsStyleGuide] = useState(initialIsStyleGuide);
  const [clearOpen, setClearOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // ─── Inline name editing ──────────────────────────────────────────

  function startEditingName() {
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.select(), 0);
  }

  async function finishEditingName() {
    setIsEditingName(false);
    const trimmed = name.trim();
    if (!trimmed) {
      setName(initialName);
      return;
    }
    if (trimmed !== initialName) {
      await fetch(`/api/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
    }
  }

  // ─── Save handler ─────────────────────────────────────────────────

  const save = useCallback(async () => {
    if (saving) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: source }),
      });

      if (!res.ok) {
        toast.error("Failed to save");
        return;
      }

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [designId, source, saving]);

  // ─── Style guide toggle ───────────────────────────────────────────

  async function toggleStyleGuide() {
    const newValue = !isStyleGuide;

    try {
      const res = await fetch(`/api/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStyleGuide: newValue }),
      });

      if (res.ok) {
        setIsStyleGuide(newValue);
        toast.success(
          newValue
            ? "Set as style guide for this project"
            : "Removed style guide status",
        );
      }
    } catch {
      toast.error("Failed to update style guide");
    }
  }

  // ─── Cmd+S keyboard shortcut ──────────────────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [save]);

  // ─── Back navigation ──────────────────────────────────────────────

  function handleBack() {
    if (projectId) {
      router.push(`/project/${projectId}/designs`);
    } else {
      router.push("/designs");
    }
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <TooltipProvider>
      <div className="flex h-11 items-center gap-2 border-b border-border/60 bg-background px-2">
        {/* ── LEFT SECTION ─────────────────────────────────────────── */}
        <div className="flex items-center gap-1.5">
          {/* Back */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleBack}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Back</TooltipContent>
          </Tooltip>

          <div className="mx-0.5 h-4 w-px bg-border/60" />

          {/* Design name (inline editable) */}
          {isEditingName ? (
            <input
              ref={nameInputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={finishEditingName}
              onKeyDown={(e) => {
                if (e.key === "Enter") finishEditingName();
                if (e.key === "Escape") {
                  setName(initialName);
                  setIsEditingName(false);
                }
              }}
              className="h-6 w-40 rounded border border-primary/40 bg-transparent px-1.5 text-xs font-medium outline-none focus:ring-1 focus:ring-primary/20"
            />
          ) : (
            <button
              onClick={startEditingName}
              className="max-w-[160px] truncate rounded px-1.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              title={name}
            >
              {name}
            </button>
          )}

          <div className="mx-0.5 h-4 w-px bg-border/60" />

          {/* Mode switcher */}
          <div className="flex items-center rounded-lg border border-border/60 bg-muted/50 p-0.5">
            {MODES.map(({ mode: m, label, icon: Icon }) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all",
                  mode === m
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── CENTER SECTION ───────────────────────────────────────── */}
        <div className="flex flex-1 items-center justify-center">
          {mode !== "code" && (
            <div className="flex items-center gap-0.5">
              {BREAKPOINTS.map(({ bp, label, icon: Icon }) => (
                <Tooltip key={bp}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setBreakpoint(bp)}
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md transition-colors",
                        breakpoint === bp
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                      )}
                    >
                      <Icon className="size-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          )}
        </div>

        {/* ── RIGHT SECTION ────────────────────────────────────────── */}
        <div className="flex items-center gap-0.5">
          {/* Generate */}
          <button
            onClick={onGenerate}
            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
          >
            <Sparkles className="size-3.5" />
            Generate
          </button>

          <div className="mx-0.5 h-4 w-px bg-border/60" />

          {/* Layers toggle */}
          {mode === "design" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleLayers}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md transition-colors",
                    showLayers
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <Layers className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Layers</TooltipContent>
            </Tooltip>
          )}

          {/* Components toggle */}
          {mode === "design" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleComponents}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md transition-colors",
                    showComponents
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                  )}
                >
                  <LayoutGrid className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Components</TooltipContent>
            </Tooltip>
          )}

          {/* Chat toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleChat}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  showChat
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                <MessageSquare className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Chat history</TooltipContent>
          </Tooltip>

          <div className="mx-0.5 h-4 w-px bg-border/60" />

          {/* Undo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={undo}
                disabled={!canUndo}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  canUndo
                    ? "text-foreground hover:bg-accent"
                    : "cursor-not-allowed text-muted-foreground/40",
                )}
              >
                <Undo2 className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>

          {/* Redo */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={redo}
                disabled={!canRedo}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md transition-colors",
                  canRedo
                    ? "text-foreground hover:bg-accent"
                    : "cursor-not-allowed text-muted-foreground/40",
                )}
              >
                <Redo2 className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>

          {/* Clear */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setClearOpen(true)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Clear design</TooltipContent>
          </Tooltip>

          {/* Style guide star (project designs only) */}
          {isProjectDesign && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleStyleGuide}
                  className={cn(
                    "flex size-7 items-center justify-center rounded-md transition-colors",
                    isStyleGuide
                      ? "text-amber-500 hover:bg-amber-500/10"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Star
                    className="size-3.5"
                    fill={isStyleGuide ? "currentColor" : "none"}
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                {isStyleGuide
                  ? "This design is the style guide for this project"
                  : "Set as style guide"}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Upgrade to Project (standalone designs only) */}
          {!isProjectDesign && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setUpgradeOpen(true)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <FolderUp className="size-3.5" />
                  Upgrade to Project
                </button>
              </TooltipTrigger>
              <TooltipContent>Turn this design into a full project</TooltipContent>
            </Tooltip>
          )}

          <div className="mx-0.5 h-4 w-px bg-border/60" />

          {/* Save */}
          <Button
            size="sm"
            onClick={save}
            disabled={saving}
            className="h-7 gap-1.5 px-3 text-[11px]"
          >
            {saving ? (
              <Loader2 className="size-3 animate-spin" />
            ) : showSaved ? (
              <Check className="size-3" />
            ) : (
              <Save className="size-3" />
            )}
            {showSaved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      {/* Clear confirmation dialog */}
      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear this design?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all code from the design. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                clearDesign();
                setClearOpen(false);
              }}
            >
              Clear Design
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Upgrade to Project modal (standalone designs only) */}
      {!isProjectDesign && (
        <UpgradeToProjectModal
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          designName={name}
        />
      )}
    </TooltipProvider>
  );
}
