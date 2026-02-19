"use client";

import { useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
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
  Pencil,
  Trash2,
  Loader2,
  FileText,
  RefreshCw,
  GripVertical,
  X,
  LayoutList,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ThinkingAnimation,
  PAGES_THINKING,
} from "@/components/features/thinking-animation";
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
  type ProjectPage,
} from "@/stores/project-store";
import type { PageContent } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { readSSEStream } from "@/lib/sse-client";
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

/* ─── ID generator ───────────────────────────────────────────────────────── */

let _counter = 0;
function makeContentId() {
  _counter++;
  return `c${Date.now()}-${_counter}`;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Pages content                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function PagesContent() {
  const {
    project,
    pages,
    setPages,
    addPage,
    updatePage,
    removePage,
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

  // AI
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenerateConfirm, setRegenerateConfirm] = useState(false);

  // Add page modal
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  // Detail / edit modal
  const [detailPage, setDetailPage] = useState<ProjectPage | null>(null);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailDesc, setDetailDesc] = useState("");
  const [detailContents, setDetailContents] = useState<PageContent[]>([]);
  const [isSavingDetail, setIsSavingDetail] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ProjectPage | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Drag-and-drop for content items
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
        `/api/projects/${project.id}/pages/generate`,
        { method: "POST" },
      );

      if (!res.ok) {
        const data = await res.json();
        if (res.status === 403) {
          setUpgradeOpen(true);
          return;
        }
        toast.error(data.error || "Failed to generate pages.");
        return;
      }

      if (res.headers.get("content-type")?.includes("text/event-stream")) {
        setPages([]);
        const items: ProjectPage[] = [];
        await readSSEStream(res, {
          onEvent: (event) => {
            if (event.type === "item" && event.page) {
              items.push(event.page as ProjectPage);
              setPages([...items]);
            }
          },
          onError: () => {
            toast.error("Generation failed. Please try again.");
          },
        });
        if (items.length > 0) {
          toast.success(`Generated ${items.length} pages.`);
        }
      } else {
        const data = await res.json();
        setPages(data.items);
        toast.success(`Generated ${data.items.length} pages.`);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
      setRegenerateConfirm(false);
    }
  }, [project, setPages]);

  function handleGenerateClick() {
    if (pages.length > 0) {
      setRegenerateConfirm(true);
    } else {
      handleGenerate();
    }
  }

  // ─── Add page ───────────────────────────────────────────────────────

  async function handleAddPage() {
    if (!project || !addTitle.trim()) return;
    setIsAdding(true);

    try {
      const res = await fetch(`/api/projects/${project.id}/pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: addTitle.trim(),
          description: addDesc.trim() || undefined,
        }),
      });

      if (res.ok) {
        const page = await res.json();
        addPage(page);
        toast.success("Page added.");
        setAddTitle("");
        setAddDesc("");
        setAddDialogOpen(false);
      } else {
        toast.error("Failed to add page.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsAdding(false);
    }
  }

  // ─── Detail / edit modal ────────────────────────────────────────────

  function openDetail(page: ProjectPage) {
    setDetailPage(page);
    setDetailTitle(page.title);
    setDetailDesc(page.description ?? "");
    setDetailContents(page.contents ? [...page.contents] : []);
  }

  function closeDetailDialog() {
    if (detailPage) {
      const titleChanged = detailTitle !== detailPage.title;
      const descChanged = detailDesc !== (detailPage.description ?? "");
      const contentsChanged = JSON.stringify(detailContents) !== JSON.stringify(detailPage.contents ?? []);
      if (titleChanged || descChanged || contentsChanged) {
        if (!window.confirm("You have unsaved changes. Discard them?")) return;
      }
    }
    setDetailPage(null);
  }

  function addContentItem() {
    setDetailContents((prev) => [
      ...prev,
      { id: makeContentId(), name: "", description: "" },
    ]);
  }

  function updateContentItem(index: number, partial: Partial<PageContent>) {
    setDetailContents((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...partial } : c)),
    );
  }

  function removeContentItem(index: number) {
    setDetailContents((prev) => prev.filter((_, i) => i !== index));
  }

  function handleContentDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = detailContents.findIndex((c) => c.id === active.id);
    const newIndex = detailContents.findIndex((c) => c.id === over.id);
    setDetailContents(arrayMove(detailContents, oldIndex, newIndex));
  }

  async function saveDetail() {
    if (!project || !detailPage) return;
    const trimmedTitle = detailTitle.trim();
    if (!trimmedTitle) {
      toast.error("Page title is required.");
      return;
    }

    const validContents = detailContents.filter((c) => c.name.trim());
    const payload = {
      title: trimmedTitle,
      description: detailDesc.trim() || undefined,
      contents: validContents.map((c) => ({
        ...c,
        name: c.name.trim(),
        description: c.description.trim(),
      })),
    };

    setIsSavingDetail(true);

    try {
      const res = await fetch(
        `/api/projects/${project.id}/pages/${detailPage.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        const updated = await res.json();
        updatePage(detailPage.id, updated);
        toast.success("Page updated.");
        setDetailPage(null);
      } else {
        toast.error("Failed to update page.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsSavingDetail(false);
    }
  }

  // ─── Delete ─────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!project || !deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(
        `/api/projects/${project.id}/pages/${deleteTarget.id}`,
        { method: "DELETE" },
      );

      if (res.ok) {
        removePage(deleteTarget.id);
        if (detailPage?.id === deleteTarget.id) setDetailPage(null);
        toast.success("Page deleted.");
      } else {
        toast.error("Failed to delete page.");
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full rounded-xl" />
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
          <h1 className="text-2xl font-semibold tracking-tight">
            Pages &amp; Content
          </h1>
          <div className="flex items-center gap-2">
            {pages.length > 0 && (
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
            {pages.length === 0 && (
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
            <Button
              size="sm"
              onClick={() => setAddDialogOpen(true)}
              disabled={generating}
            >
              <Plus className="size-4" />
              Add Page
            </Button>
          </div>
        </div>

        {/* Generating skeleton */}
        {generating && pages.length === 0 && (
          <ThinkingAnimation messages={PAGES_THINKING} />
        )}

        {/* Empty state */}
        {!generating && pages.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
            <div className="flex size-14 items-center justify-center rounded-full bg-muted">
              <FileText className="size-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-base font-medium">No pages yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Generate them with AI based on your project features and user
              flows, or add your own manually.
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
              <Button size="sm" onClick={() => setAddDialogOpen(true)}>
                <Plus className="size-4" />
                Add Page
              </Button>
            </div>
          </div>
        )}

        {/* Page cards grid */}
        {pages.length > 0 && (
          <motion.div
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {pages.map((page) => (
              <motion.div key={page.id} id={page.id} variants={staggerItem} className="h-full">
                <PageCard
                  page={page}
                  onOpen={() => openDetail(page)}
                  onDelete={() => setDeleteTarget(page)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Add Page Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Page</DialogTitle>
            <DialogDescription>
              Create a new page. You can add content items after saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Input
                placeholder="Page title (e.g. Dashboard, Settings)"
                value={addTitle}
                onChange={(e) => setAddTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const next = e.currentTarget
                      .closest("[role=dialog]")
                      ?.querySelector("textarea");
                    next?.focus();
                  }
                }}
                autoFocus
              />
            </div>
            <div>
              <Textarea
                placeholder="Brief description of this page (optional)"
                value={addDesc}
                onChange={(e) => setAddDesc(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
              disabled={isAdding}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAddPage}
              disabled={!addTitle.trim() || isAdding}
            >
              {isAdding ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Page Detail / Edit Dialog */}
      <Dialog
        open={!!detailPage}
        onOpenChange={(open) => { if (!open) closeDetailDialog(); }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Page</DialogTitle>
            <DialogDescription>
              Update the page details and manage its content sections.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Title</label>
              <Input
                placeholder="Page title"
                value={detailTitle}
                onChange={(e) => setDetailTitle(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                Description
              </label>
              <Textarea
                placeholder="What is this page for?"
                value={detailDesc}
                onChange={(e) => setDetailDesc(e.target.value)}
                rows={2}
              />
            </div>

            {/* Content items */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">
                  Content Sections
                  {detailContents.length > 0 && (
                    <span className="ml-1.5 text-muted-foreground">
                      ({detailContents.length})
                    </span>
                  )}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addContentItem}
                  type="button"
                >
                  <Plus className="size-3.5" />
                  Add Content Item
                </Button>
              </div>

              {detailContents.length === 0 && (
                <div className="rounded-lg border border-dashed border-border/60 py-8 text-center">
                  <LayoutList className="mx-auto size-5 text-muted-foreground/50" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    No content sections yet. Add one above.
                  </p>
                </div>
              )}

              {detailContents.length > 0 && (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleContentDragEnd}
                >
                  <SortableContext
                    items={detailContents.map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {detailContents.map((item, i) => (
                        <SortableContentItem
                          key={item.id}
                          item={item}
                          index={i}
                          onUpdate={(partial) => updateContentItem(i, partial)}
                          onRemove={() => removeContentItem(i)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeDetailDialog}
              disabled={isSavingDetail}
            >
              Cancel
            </Button>
            <Button
              onClick={saveDetail}
              disabled={!detailTitle.trim() || isSavingDetail}
            >
              {isSavingDetail ? (
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
            <AlertDialogTitle>Regenerate pages?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace all {pages.length} existing pages with new
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
            <AlertDialogTitle>Delete page?</AlertDialogTitle>
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
        feature="AI page generation requires a paid plan. Upgrade to unlock this feature."
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Page Card                                                                */
/* ═══════════════════════════════════════════════════════════════════════════ */

function PageCard({
  page,
  onOpen,
  onDelete,
}: {
  page: ProjectPage;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const contents = page.contents ?? [];
  const maxVisible = 5;

  return (
    <Card
      className="group h-full cursor-pointer transition-colors hover:border-primary/50"
      onClick={onOpen}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-sm">{page.title}</CardTitle>
          {page.description && (
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {page.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {contents.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {contents.length} {contents.length === 1 ? "section" : "sections"}
            </Badge>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
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
      </CardHeader>
      {contents.length > 0 && (
        <CardContent className="pb-3">
          <ul className="space-y-1">
            {contents.slice(0, maxVisible).map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-2 text-xs text-muted-foreground"
              >
                <span className="size-1 shrink-0 rounded-full bg-muted-foreground/30" />
                <span className="truncate">{item.name}</span>
              </li>
            ))}
            {contents.length > maxVisible && (
              <li className="text-xs text-muted-foreground/60">
                +{contents.length - maxVisible} more
              </li>
            )}
          </ul>
        </CardContent>
      )}
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Sortable Content Item                                                    */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface SortableContentItemProps {
  item: PageContent;
  index: number;
  onUpdate: (partial: Partial<PageContent>) => void;
  onRemove: () => void;
}

function SortableContentItem({
  item,
  index,
  onUpdate,
  onRemove,
}: SortableContentItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-lg border border-border/60 p-3",
        isDragging && "z-50 shadow-lg",
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <button
          {...attributes}
          {...listeners}
          className="flex size-5 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" />
        </button>
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
          {index + 1}
        </span>
        <Input
          placeholder="Section name"
          value={item.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="h-8 text-sm"
        />
        <button
          onClick={onRemove}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <Textarea
        placeholder="Describe this section..."
        value={item.description}
        onChange={(e) => onUpdate({ description: e.target.value })}
        rows={2}
        className="text-xs"
      />
    </div>
  );
}
