"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Lightbulb,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  useProjectStore,
  type ProjectFeature,
} from "@/stores/project-store";
import { cn } from "@/lib/utils";
import { UpgradeModal } from "@/components/features/upgrade-modal";

/* ─── Animation ──────────────────────────────────────────────────────────── */

const container = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const cardItem = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.4, 0, 1] as [number, number, number, number],
    },
  },
  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
};

/* ─── Helpers ─────────────────────────────────────────────────────────── */

/** Split a feature description into bullet points by sentence or line break. */
function descriptionToBullets(description: string): string[] {
  // First try splitting by newlines
  const lines = description
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 1) return lines;

  // Then split by sentence-ending punctuation
  const sentences = description
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (sentences.length > 1) return sentences;

  // Return as single item
  return [description];
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Features content                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function FeaturesContent() {
  const {
    project,
    features,
    setFeatures,
    addFeature,
    updateFeature,
    removeFeature,
    loading,
  } = useProjectStore();

  // Scroll to item from sidebar hash navigation
  useEffect(() => {
    if (loading) return;
    function scrollToHash() {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      setTimeout(() => {
        const el = document.getElementById(hash);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.classList.add("ring-2", "ring-primary", "rounded-xl");
          setTimeout(() => el.classList.remove("ring-2", "ring-primary", "rounded-xl"), 2000);
        }
        window.history.replaceState(null, "", window.location.pathname);
      }, 300);
    }
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [loading]);

  // UI state
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectFeature | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<ProjectFeature | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Add dialog state
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [pendingFeatures, setPendingFeatures] = useState<{ title: string; description: string }[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingPendingIndex, setEditingPendingIndex] = useState<number | null>(null);
  const [editingPendingTitle, setEditingPendingTitle] = useState("");
  const [editingPendingDesc, setEditingPendingDesc] = useState("");

  // ─── AI Generation ──────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    setGenerating(true);

    try {
      const res = await fetch(
        `/api/projects/${project.id}/features/generate`,
        { method: "POST" },
      );

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 403) {
          setUpgradeOpen(true);
          return;
        }
        toast.error(data.error || "Failed to generate features.");
        return;
      }

      const data = await res.json();
      setFeatures(data.items);
      toast.success(`Generated ${data.items.length} features.`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
      setRegenerateConfirm(false);
    }
  }, [project, setFeatures]);

  function handleGenerateClick() {
    if (features.length > 0) {
      setRegenerateConfirm(true);
    } else {
      handleGenerate();
    }
  }

  // ─── Add feature ───────────────────────────────────────────────────

  function handleAddAnother() {
    if (!addTitle.trim()) return;
    setPendingFeatures((prev) => [
      ...prev,
      { title: addTitle.trim(), description: addDesc.trim() || "" },
    ]);
    setAddTitle("");
    setAddDesc("");
  }

  function handleRemovePending(index: number) {
    setPendingFeatures((prev) => prev.filter((_, i) => i !== index));
  }

  function handleEditPending(index: number) {
    const pf = pendingFeatures[index];
    setEditingPendingIndex(index);
    setEditingPendingTitle(pf.title);
    setEditingPendingDesc(pf.description);
  }

  function handleSavePendingEdit() {
    if (editingPendingIndex === null || !editingPendingTitle.trim()) return;
    setPendingFeatures((prev) =>
      prev.map((pf, i) =>
        i === editingPendingIndex
          ? { title: editingPendingTitle.trim(), description: editingPendingDesc.trim() }
          : pf,
      ),
    );
    setEditingPendingIndex(null);
  }

  function handleCancelPendingEdit() {
    setEditingPendingIndex(null);
  }

  async function handleSaveFeatures() {
    if (!project) return;

    // Include current fields if title is filled
    const allFeatures = [...pendingFeatures];
    if (addTitle.trim()) {
      allFeatures.push({ title: addTitle.trim(), description: addDesc.trim() || "" });
    }

    if (allFeatures.length === 0) return;

    setIsAdding(true);
    let addedCount = 0;

    try {
      for (const f of allFeatures) {
        const res = await fetch(`/api/projects/${project.id}/features`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(f),
        });

        if (res.ok) {
          const feature = await res.json();
          addFeature(feature);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        toast.success(`Added ${addedCount} feature${addedCount !== 1 ? "s" : ""}.`);
      } else {
        toast.error("Failed to add features.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsAdding(false);
      setAddTitle("");
      setAddDesc("");
      setPendingFeatures([]);
      setAddDialogOpen(false);
    }
  }

  function handleCloseAddDialog() {
    setAddTitle("");
    setAddDesc("");
    setPendingFeatures([]);
    setEditingPendingIndex(null);
    setAddDialogOpen(false);
  }

  // ─── Edit feature ──────────────────────────────────────────────────

  function startEdit(feature: ProjectFeature) {
    setEditTarget(feature);
    setEditTitle(feature.title);
    setEditDesc(feature.description);
  }

  async function saveEdit() {
    if (!project || !editTarget) return;
    const trimmedTitle = editTitle.trim();
    const trimmedDesc = editDesc.trim();
    if (!trimmedTitle || !trimmedDesc) return;

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/projects/${project.id}/features/${editTarget.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: trimmedTitle,
            description: trimmedDesc,
          }),
        },
      );

      if (res.ok) {
        updateFeature(editTarget.id, {
          title: trimmedTitle,
          description: trimmedDesc,
        });
        toast.success("Feature updated.");
        setEditTarget(null);
      } else {
        toast.error("Failed to update feature.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Delete feature ────────────────────────────────────────────────

  async function handleDelete() {
    if (!project || !deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(
        `/api/projects/${project.id}/features/${deleteTarget.id}`,
        { method: "DELETE" },
      );

      if (res.ok) {
        removeFeature(deleteTarget.id);
        toast.success("Feature deleted.");
      } else {
        toast.error("Failed to delete feature.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────

  if (loading || !project) {
    return (
      <div className="p-6 sm:p-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-xl border border-border/60 shadow-sm"
            >
              <div className="bg-primary/10 px-5 py-4">
                <Skeleton className="h-5 w-3/4" />
              </div>
              <div className="space-y-2 px-5 py-4">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="p-6 sm:p-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Features</h1>
            {features.length > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {features.length} feature{features.length !== 1 ? "s" : ""} defined for this project
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {features.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateClick}
                disabled={generating}
              >
                <RefreshCw
                  className={cn("size-4", generating && "animate-spin")}
                />
                Regenerate
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={
                features.length > 0
                  ? handleGenerateClick
                  : () => handleGenerate()
              }
              disabled={generating}
              className={features.length > 0 ? "hidden" : ""}
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Generate with AI
            </Button>
            <Button
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              disabled={generating}
            >
              <Plus className="size-4" />
              Add Feature
            </Button>
          </div>
        </div>

        {/* Generating skeleton */}
        {generating && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-xl border border-border/60 shadow-sm"
              >
                <div className="bg-primary/10 px-5 py-4">
                  <Skeleton className="h-5 w-3/4" />
                </div>
                <div className="space-y-2 px-5 py-4">
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-5/6" />
                  <Skeleton className="h-3 w-4/6" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!generating && features.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <Lightbulb className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-base font-medium">No features yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Generate them with AI from your project description, or add your
              own manually.
            </p>
            <div className="mt-5 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerate()}
                disabled={generating}
              >
                <Sparkles className="size-4" />
                Generate with AI
              </Button>
              <Button
                size="sm"
                onClick={() => setAddDialogOpen(true)}
              >
                <Plus className="size-4" />
                Add Feature
              </Button>
            </div>
          </div>
        )}

        {/* Feature card grid */}
        {!generating && features.length > 0 && (
          <motion.div
            variants={container}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          >
            <AnimatePresence mode="popLayout">
              {features.map((feature) => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  onEdit={() => startEdit(feature)}
                  onDelete={() => setDeleteTarget(feature)}
                />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {/* Add Feature Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) handleCloseAddDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Features</DialogTitle>
            <DialogDescription className="sr-only">
              Add one or more features to your project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Pending features list */}
            {pendingFeatures.length > 0 && (
              <div className="space-y-2">
                {pendingFeatures.map((pf, i) =>
                  editingPendingIndex === i ? (
                    <div
                      key={i}
                      className="space-y-2 rounded-lg border border-primary/30 bg-muted/30 p-3"
                    >
                      <Input
                        value={editingPendingTitle}
                        onChange={(e) => setEditingPendingTitle(e.target.value)}
                        placeholder="Feature title..."
                        autoFocus
                      />
                      <Textarea
                        value={editingPendingDesc}
                        onChange={(e) => setEditingPendingDesc(e.target.value)}
                        placeholder="Description..."
                        rows={2}
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleCancelPendingEdit}
                        >
                          Cancel
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSavePendingEdit}
                          disabled={!editingPendingTitle.trim()}
                        >
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{pf.title}</p>
                        {pf.description && (
                          <p className="truncate text-xs text-muted-foreground">{pf.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleEditPending(i)}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="size-3" />
                      </button>
                      <button
                        onClick={() => handleRemovePending(i)}
                        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ),
                )}
              </div>
            )}

            <Input
              placeholder="New feature title..."
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const next = e.currentTarget
                    .closest("form, [role=dialog]")
                    ?.querySelector("textarea");
                  next?.focus();
                }
              }}
              autoFocus
            />
            <Textarea
              placeholder="Description of your new feature..."
              value={addDesc}
              onChange={(e) => setAddDesc(e.target.value)}
              rows={4}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={handleAddAnother}
              disabled={!addTitle.trim()}
            >
              Add Another Feature
              <Plus className="size-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button
              onClick={handleSaveFeatures}
              disabled={(pendingFeatures.length === 0 && !addTitle.trim()) || isAdding}
            >
              {isAdding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                `Save Feature${pendingFeatures.length + (addTitle.trim() ? 1 : 0) !== 1 ? "s" : ""}`
              )}
            </Button>
            <Button
              variant="ghost"
              onClick={handleCloseAddDialog}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Feature Dialog */}
      <Dialog
        open={!!editTarget}
        onOpenChange={(open) => !open && setEditTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Feature</DialogTitle>
            <DialogDescription>
              Update this feature&apos;s title and description.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Feature title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const next = e.currentTarget
                      .closest("form, [role=dialog]")
                      ?.querySelector("textarea");
                    next?.focus();
                  }
                }}
                autoFocus
              />
            </div>
            <div>
              <Textarea
                placeholder="What does this feature do and why does it matter?"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditTarget(null)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={saveEdit}
              disabled={!editTitle.trim() || !editDesc.trim() || isSaving}
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Regenerate confirmation */}
      <AlertDialog
        open={regenerateConfirm}
        onOpenChange={setRegenerateConfirm}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate features?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all {features.length} existing features with
              new AI-generated ones. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Regenerate"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete feature?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.title}&rdquo; will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="AI feature generation requires a paid plan. Upgrade to unlock this feature."
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Feature Card                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface FeatureCardProps {
  feature: ProjectFeature;
  onEdit: () => void;
  onDelete: () => void;
}

function FeatureCard({ feature, onEdit, onDelete }: FeatureCardProps) {
  const bullets = descriptionToBullets(feature.description);

  return (
    <motion.div
      id={feature.id}
      variants={cardItem}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <div
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all",
          "hover:border-border hover:shadow-md",
        )}
      >
        {/* Colored header with title */}
        <div className="relative bg-primary/10 px-5 py-4">
          <h3 className="pr-14 text-sm font-bold leading-snug">
            {feature.title}
          </h3>

          {/* Actions */}
          <div className="absolute right-2.5 top-2.5 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button
              onClick={onEdit}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-background/60 hover:text-foreground"
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              onClick={onDelete}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Body with description and bullets */}
        <div className="flex flex-1 flex-col px-5 py-4">
          {bullets.length > 1 ? (
            <>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {bullets[0]}
              </p>
              <ul className="mt-3 space-y-2">
                {bullets.slice(1).map((bullet, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground"
                  >
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted-foreground">
              {feature.description}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
