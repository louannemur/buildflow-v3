"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  GitBranch,
  List,
  Share2,
  X,
  RefreshCw,
  GripVertical,
  MousePointer,
  GitFork,
  ArrowRight,
  FormInput,
  Monitor,
  ArrowDown,
  Circle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useProjectStore,
  type ProjectUserFlow,
} from "@/stores/project-store";
import type { FlowStep } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { UpgradeModal } from "@/components/features/upgrade-modal";

/* ─── Animation ──────────────────────────────────────────────────────────── */

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.4, 0, 1] as [number, number, number, number],
    },
  },
};

/* ─── Step type config ───────────────────────────────────────────────────── */

const stepTypeConfig: Record<
  string,
  { label: string; icon: typeof MousePointer; color: string; badge: string }
> = {
  action: { label: "Action", icon: MousePointer, color: "text-blue-500 bg-blue-500/10 border-blue-500/20", badge: "text-amber-600" },
  decision: { label: "Decision", icon: GitFork, color: "text-amber-500 bg-amber-500/10 border-amber-500/20", badge: "text-red-500" },
  navigation: { label: "Navigation", icon: ArrowRight, color: "text-green-500 bg-green-500/10 border-green-500/20", badge: "text-green-600" },
  input: { label: "Input", icon: FormInput, color: "text-violet-500 bg-violet-500/10 border-violet-500/20", badge: "text-violet-500" },
  display: { label: "Display", icon: Monitor, color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20", badge: "text-cyan-600" },
};

function getStepConfig(type: string) {
  return stepTypeConfig[type] ?? stepTypeConfig.action;
}

/* ─── ID generator ───────────────────────────────────────────────────────── */

let _counter = 0;
function makeStepId() {
  _counter++;
  return `s${Date.now()}-${_counter}`;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Flows content                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function FlowsContent() {
  const {
    project,
    userFlows,
    setUserFlows,
    addUserFlow,
    updateUserFlow,
    removeUserFlow,
    loading,
  } = useProjectStore();

  // Scroll to item from sidebar hash navigation
  useEffect(() => {
    if (loading) return;
    function scrollToHash() {
      const hash = window.location.hash.slice(1);
      if (!hash) return;
      document.querySelectorAll(".ring-2.ring-primary").forEach((prev) => {
        prev.classList.remove("ring-2", "ring-primary", "rounded-xl");
      });
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

  // View
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  type ViewMode = "list" | "diagram";
  const [view, setView] = useState<ViewMode>("list");
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);

  // AI
  const [generating, setGenerating] = useState(false);
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);

  // Add/Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<ProjectUserFlow | null>(null);
  const [modalTitle, setModalTitle] = useState("");
  const [modalSteps, setModalSteps] = useState<FlowStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ProjectUserFlow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const selectedFlow = userFlows.find((f) => f.id === selectedFlowId) ?? null;

  // ─── AI Generation ──────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!project) return;
    setGenerating(true);

    try {
      const res = await fetch(`/api/projects/${project.id}/flows/generate`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 403) {
          setUpgradeOpen(true);
          return;
        }
        toast.error(data.error || "Failed to generate flows.");
        return;
      }

      const data = await res.json();
      setUserFlows(data.items);
      toast.success(`Generated ${data.items.length} user flows.`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
      setRegenerateConfirm(false);
    }
  }, [project, setUserFlows]);

  function handleGenerateClick() {
    if (userFlows.length > 0) {
      setRegenerateConfirm(true);
    } else {
      handleGenerate();
    }
  }

  // ─── Add / Edit modal ──────────────────────────────────────────────

  function openAddModal() {
    setEditingFlow(null);
    setModalTitle("");
    setModalSteps([
      { id: makeStepId(), title: "", description: "", type: "action" },
    ]);
    setModalOpen(true);
  }

  function openEditModal(flow: ProjectUserFlow) {
    setEditingFlow(flow);
    setModalTitle(flow.title);
    setModalSteps([...flow.steps]);
    setModalOpen(true);
  }

  function addModalStep() {
    setModalSteps((prev) => [
      ...prev,
      { id: makeStepId(), title: "", description: "", type: "action" },
    ]);
  }

  function removeModalStep(index: number) {
    setModalSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function updateModalStep(index: number, partial: Partial<FlowStep>) {
    setModalSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...partial } : s)),
    );
  }

  function moveModalStep(from: number, to: number) {
    setModalSteps((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(from, 1);
      copy.splice(to, 0, item);
      return copy;
    });
  }

  async function handleSave() {
    if (!project) return;
    const trimmedTitle = modalTitle.trim();
    const validSteps = modalSteps.filter((s) => s.title.trim());
    if (!trimmedTitle || validSteps.length === 0) {
      toast.error("Please provide a title and at least one step.");
      return;
    }

    const payload = {
      title: trimmedTitle,
      steps: validSteps.map((s) => ({
        ...s,
        title: s.title.trim(),
        description: s.description.trim(),
      })),
    };

    setIsSaving(true);

    try {
      if (editingFlow) {
        const res = await fetch(
          `/api/projects/${project.id}/flows/${editingFlow.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          },
        );
        if (res.ok) {
          const updated = await res.json();
          updateUserFlow(editingFlow.id, updated);
          toast.success("Flow updated.");
        } else {
          toast.error("Failed to update flow.");
        }
      } else {
        const res = await fetch(`/api/projects/${project.id}/flows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          const flow = await res.json();
          addUserFlow(flow);
          toast.success("Flow created.");
        } else {
          toast.error("Failed to create flow.");
        }
      }
      setModalOpen(false);
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!project || !deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(
        `/api/projects/${project.id}/flows/${deleteTarget.id}`,
        { method: "DELETE" },
      );
      if (res.ok) {
        removeUserFlow(deleteTarget.id);
        if (selectedFlowId === deleteTarget.id) setSelectedFlowId(null);
        toast.success("Flow deleted.");
      } else {
        toast.error("Failed to delete flow.");
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
        <div className="grid gap-5 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card shadow-sm"
            >
              <div className="flex items-center justify-between px-6 pt-5 pb-1">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="space-y-3 px-6 pt-3 pb-5">
                {Array.from({ length: 4 }).map((_, j) => (
                  <div key={j} className="flex items-center gap-3">
                    <Skeleton className="size-6 shrink-0 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-16 shrink-0" />
                  </div>
                ))}
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
          <h1 className="text-2xl font-semibold tracking-tight">User Flows</h1>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            {userFlows.length > 0 && (
              <div className="flex rounded-lg border border-border/60">
                <button
                  onClick={() => setView("list")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-l-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    view === "list"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <List className="size-3.5" />
                  List
                </button>
                <button
                  onClick={() => setView("diagram")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-r-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    view === "diagram"
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Share2 className="size-3.5" />
                  Diagram
                </button>
              </div>
            )}

            {userFlows.length > 0 && (
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
            {userFlows.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleGenerate()}
                disabled={generating}
              >
                {generating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Generate with AI
              </Button>
            )}
            <Button size="sm" onClick={openAddModal} disabled={generating}>
              <Plus className="size-4" />
              Add Flow
            </Button>
          </div>
        </div>

        {/* Generating skeleton */}
        {generating && (
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border border-border/60 bg-card shadow-sm"
              >
                <div className="flex items-center justify-between px-6 pt-5 pb-1">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="space-y-3 px-6 pt-3 pb-5">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3">
                      <Skeleton className="size-6 shrink-0 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                      <Skeleton className="h-4 w-16 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!generating && userFlows.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <GitBranch className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-base font-medium">No user flows yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Generate them with AI based on your project features, or create
              your own manually.
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
              <Button size="sm" onClick={openAddModal}>
                <Plus className="size-4" />
                Add Flow
              </Button>
            </div>
          </div>
        )}

        {/* List view */}
        {!generating && userFlows.length > 0 && view === "list" && (() => {
          const MAX_VISIBLE = 6;
          const maxSteps = Math.min(Math.max(...userFlows.map((f) => f.steps.length)), MAX_VISIBLE);

          return (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="grid gap-5 sm:grid-cols-2"
            >
              {userFlows.map((flow) => (
                <motion.div key={flow.id} id={flow.id} variants={staggerItem} className="h-full">
                  <FlowCard
                    flow={flow}
                    uniformStepCount={maxSteps}
                    isSelected={selectedFlowId === flow.id}
                    onSelect={() => {
                      setSelectedFlowId(flow.id);
                      setView("diagram");
                    }}
                    onEdit={() => openEditModal(flow)}
                    onDelete={() => setDeleteTarget(flow)}
                  />
                </motion.div>
              ))}
            </motion.div>
          );
        })()}

        {/* Diagram view */}
        {!generating && userFlows.length > 0 && view === "diagram" && (
          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Flow selector sidebar */}
            <div className="w-full shrink-0 lg:w-56">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Select a flow
              </p>
              <div className="space-y-1">
                {userFlows.map((flow) => (
                  <button
                    key={flow.id}
                    onClick={() => setSelectedFlowId(flow.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                      selectedFlowId === flow.id
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    )}
                  >
                    <GitBranch className="size-3.5 shrink-0" />
                    <span className="truncate">{flow.title}</span>
                    <Badge
                      variant="secondary"
                      className="ml-auto shrink-0 text-[10px]"
                    >
                      {flow.steps.length}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* Diagram area */}
            <div className="flex-1">
              {selectedFlow ? (
                <FlowDiagram flow={selectedFlow} />
              ) : (
                <div className="flex items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
                  <p className="text-sm text-muted-foreground">
                    Select a flow to view its diagram
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Flow Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingFlow ? "Edit Flow" : "Add Flow"}
            </DialogTitle>
            <DialogDescription>
              Define the steps a user takes to complete this flow.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Input
              placeholder="Flow title (e.g. User Registration)"
              value={modalTitle}
              onChange={(e) => setModalTitle(e.target.value)}
              autoFocus
            />

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">Steps</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addModalStep}
                  type="button"
                >
                  <Plus className="size-3.5" />
                  Add Step
                </Button>
              </div>

              <div className="space-y-3">
                {modalSteps.map((step, i) => (
                  <div
                    key={step.id}
                    className="rounded-lg border border-border/60 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                        {i + 1}
                      </span>
                      <Input
                        placeholder="Step title"
                        value={step.title}
                        onChange={(e) =>
                          updateModalStep(i, { title: e.target.value })
                        }
                        className="h-8 text-sm"
                      />
                      <Select
                        value={step.type}
                        onValueChange={(v) =>
                          updateModalStep(i, { type: v })
                        }
                      >
                        <SelectTrigger className="h-8 w-28 shrink-0 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="action">Action</SelectItem>
                          <SelectItem value="decision">Decision</SelectItem>
                          <SelectItem value="navigation">Navigate</SelectItem>
                          <SelectItem value="input">Input</SelectItem>
                          <SelectItem value="display">Display</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="flex shrink-0 gap-0.5">
                        {i > 0 && (
                          <button
                            onClick={() => moveModalStep(i, i - 1)}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Move up"
                          >
                            <GripVertical className="size-3.5" />
                          </button>
                        )}
                        {modalSteps.length > 1 && (
                          <button
                            onClick={() => removeModalStep(i)}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <Textarea
                      placeholder="What happens in this step?"
                      value={step.description}
                      onChange={(e) =>
                        updateModalStep(i, { description: e.target.value })
                      }
                      rows={2}
                      className="text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                !modalTitle.trim() ||
                modalSteps.filter((s) => s.title.trim()).length === 0 ||
                isSaving
              }
            >
              {isSaving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : editingFlow ? (
                "Save Changes"
              ) : (
                "Create Flow"
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
            <AlertDialogTitle>Regenerate user flows?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all {userFlows.length} existing flows with new
              AI-generated ones. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generating}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerate} disabled={generating}>
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
            <AlertDialogTitle>Delete flow?</AlertDialogTitle>
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
        feature="AI flow generation requires a paid plan. Upgrade to unlock this feature."
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Flow Card (List View)                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

function FlowCard({
  flow,
  uniformStepCount,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: {
  flow: ProjectUserFlow;
  uniformStepCount: number;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const MAX_VISIBLE = 6;
  const visibleSteps = flow.steps.slice(0, MAX_VISIBLE);
  const remaining = flow.steps.length - MAX_VISIBLE;
  // Invisible spacer rows to equalize card heights
  const emptySlots = Math.max(0, uniformStepCount - visibleSteps.length);

  return (
    <div
      onClick={onSelect}
      className={cn(
        "group flex h-full cursor-pointer flex-col rounded-xl border border-border/60 bg-card shadow-sm transition-all hover:border-border hover:shadow-md",
        isSelected && "border-primary/40 ring-1 ring-primary/20",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-5 pb-1">
        <h3 className="text-base font-semibold leading-snug">{flow.title}</h3>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full border border-border/80 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            {flow.steps.length} steps
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Steps */}
      <div className="flex flex-1 flex-col px-6 pt-3 pb-5">
        <ol className="space-y-2.5">
          {visibleSteps.map((step, i) => {
            const cfg = getStepConfig(step.type);
            return (
              <li key={step.id} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted/70 text-[11px] font-semibold text-muted-foreground">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                  {step.title}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-xs font-semibold",
                    cfg.badge,
                  )}
                >
                  {cfg.label}
                </span>
              </li>
            );
          })}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <li key={`spacer-${i}`} className="h-6" aria-hidden />
          ))}
        </ol>
        {remaining > 0 && (
          <p className="mt-auto pt-3 text-xs text-muted-foreground/50">
            +{remaining} more step{remaining !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Flow Diagram (Diagram View)                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function FlowDiagram({ flow }: { flow: ProjectUserFlow }) {
  return (
    <TooltipProvider delayDuration={200}>
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{flow.title}</h2>
          <Badge variant="outline" className="text-xs">
            {flow.steps.length} steps
          </Badge>
        </div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="flex flex-col items-center"
        >
          {/* Start node */}
          <motion.div variants={staggerItem}>
            <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
              <Circle className="size-4 fill-current" />
            </div>
          </motion.div>

          {flow.steps.map((step, i) => {
            const cfg = getStepConfig(step.type);
            const Icon = cfg.icon;
            const isDecision = step.type === "decision";

            return (
              <motion.div
                key={step.id}
                variants={staggerItem}
                className="flex flex-col items-center"
              >
                {/* Connector arrow */}
                <div className="flex flex-col items-center py-1">
                  <div className="h-4 w-px bg-border" />
                  <ArrowDown className="size-3 text-muted-foreground/50" />
                </div>

                {/* Step node */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "flex min-w-[200px] max-w-[320px] items-center gap-3 border px-4 py-3 shadow-sm transition-shadow hover:shadow-md",
                        isDecision
                          ? "rotate-0 rounded-lg border-amber-500/30 bg-amber-500/5"
                          : "rounded-xl",
                        !isDecision && "border-border/60 bg-card",
                      )}
                    >
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-md border",
                          cfg.color,
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-muted-foreground/50">
                            {i + 1}
                          </span>
                          <p className="truncate text-sm font-medium">
                            {step.title}
                          </p>
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-xs">
                    <p className="text-xs font-medium">{step.title}</p>
                    {step.description && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {step.description}
                      </p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      Type: {cfg.label}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </motion.div>
            );
          })}

          {/* End node */}
          <motion.div
            variants={staggerItem}
            className="flex flex-col items-center"
          >
            <div className="flex flex-col items-center py-1">
              <div className="h-4 w-px bg-border" />
              <ArrowDown className="size-3 text-muted-foreground/50" />
            </div>
            <div className="flex size-10 items-center justify-center rounded-full border-2 border-primary bg-background shadow-sm">
              <Circle className="size-3 fill-primary text-primary" />
            </div>
          </motion.div>
        </motion.div>
      </div>
    </TooltipProvider>
  );
}
