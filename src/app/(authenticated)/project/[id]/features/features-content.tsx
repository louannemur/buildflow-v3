"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Sparkles,
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Loader2,
  Lightbulb,
  Check,
  X,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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

const listItem = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.25, 0.4, 0, 1] as [number, number, number, number],
    },
  },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

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

  // UI state
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProjectFeature | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Add dialog state
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

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

  async function handleAdd() {
    if (!project || !addTitle.trim() || !addDesc.trim()) return;
    setIsAdding(true);

    try {
      const res = await fetch(`/api/projects/${project.id}/features`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          description: addDesc.trim(),
        }),
      });

      if (res.ok) {
        const feature = await res.json();
        addFeature(feature);
        toast.success("Feature added.");
      } else {
        toast.error("Failed to add feature.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsAdding(false);
    }
  }

  async function handleAddAndClose() {
    await handleAdd();
    setAddTitle("");
    setAddDesc("");
    setAddDialogOpen(false);
  }

  async function handleAddAnother() {
    await handleAdd();
    setAddTitle("");
    setAddDesc("");
  }

  // ─── Edit feature ──────────────────────────────────────────────────

  function startEdit(feature: ProjectFeature) {
    setEditingId(feature.id);
    setEditTitle(feature.title);
    setEditDesc(feature.description);
  }

  async function saveEdit() {
    if (!project || !editingId) return;
    const trimmedTitle = editTitle.trim();
    const trimmedDesc = editDesc.trim();
    if (!trimmedTitle || !trimmedDesc) return;

    try {
      const res = await fetch(
        `/api/projects/${project.id}/features/${editingId}`,
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
        updateFeature(editingId, {
          title: trimmedTitle,
          description: trimmedDesc,
        });
        toast.success("Feature updated.");
      } else {
        toast.error("Failed to update feature.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setEditingId(null);
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

  // ─── Drag and drop ─────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !project) return;

    const oldIndex = features.findIndex((f) => f.id === active.id);
    const newIndex = features.findIndex((f) => f.id === over.id);

    const reordered = arrayMove(features, oldIndex, newIndex);
    setFeatures(reordered);

    try {
      await fetch(`/api/projects/${project.id}/features/reorder`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureIds: reordered.map((f) => f.id),
        }),
      });
    } catch {
      // Revert on failure
      setFeatures(features);
      toast.error("Failed to reorder features.");
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────

  if (loading || !project) {
    return (
      <div className="p-6 sm:p-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
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
          <h1 className="text-2xl font-semibold tracking-tight">Features</h1>
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
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl border border-border/60 p-4"
              >
                <Skeleton className="mt-0.5 size-5 shrink-0 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full" />
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

        {/* Feature list */}
        {!generating && features.length > 0 && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={features.map((f) => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                <AnimatePresence mode="popLayout">
                  {features.map((feature) => (
                    <SortableFeatureCard
                      key={feature.id}
                      feature={feature}
                      isEditing={editingId === feature.id}
                      editTitle={editTitle}
                      editDesc={editDesc}
                      onEditTitleChange={setEditTitle}
                      onEditDescChange={setEditDesc}
                      onStartEdit={() => startEdit(feature)}
                      onSaveEdit={saveEdit}
                      onCancelEdit={() => setEditingId(null)}
                      onDelete={() => setDeleteTarget(feature)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Add Feature Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Feature</DialogTitle>
            <DialogDescription>
              Describe a key feature for your project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Feature title"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    // Focus description
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
                value={addDesc}
                onChange={(e) => setAddDesc(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddAnother}
              disabled={!addTitle.trim() || !addDesc.trim() || isAdding}
            >
              {isAdding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Add Another"
              )}
            </Button>
            <Button
              size="sm"
              onClick={handleAddAndClose}
              disabled={!addTitle.trim() || !addDesc.trim() || isAdding}
            >
              Done
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
/*  Sortable Feature Card                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface SortableFeatureCardProps {
  feature: ProjectFeature;
  isEditing: boolean;
  editTitle: string;
  editDesc: string;
  onEditTitleChange: (v: string) => void;
  onEditDescChange: (v: string) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
}

function SortableFeatureCard({
  feature,
  isEditing,
  editTitle,
  editDesc,
  onEditTitleChange,
  onEditDescChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: SortableFeatureCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: feature.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      variants={listItem}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <Card
        className={cn(
          "group flex items-start gap-3 p-4 transition-shadow",
          isDragging && "z-50 shadow-lg",
        )}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-0.5 flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>

        {isEditing ? (
          <div className="flex-1 space-y-2">
            <Input
              value={editTitle}
              onChange={(e) => onEditTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSaveEdit();
                }
                if (e.key === "Escape") onCancelEdit();
              }}
              className="h-8 text-sm font-medium"
              autoFocus
            />
            <Textarea
              value={editDesc}
              onChange={(e) => onEditDescChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancelEdit();
              }}
              className="text-sm"
              rows={2}
            />
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={onSaveEdit}>
                <Check className="size-3.5" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                <X className="size-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-snug">
                {feature.title}
              </p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                onClick={onStartEdit}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
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
          </>
        )}
      </Card>
    </motion.div>
  );
}
