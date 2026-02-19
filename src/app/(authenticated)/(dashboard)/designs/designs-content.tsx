"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Paintbrush,
  Palette,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  FolderPlus,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { UpgradeModal } from "@/components/features/upgrade-modal";
import { HtmlPreview } from "@/components/features/html-preview";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface DesignItem {
  id: string;
  name: string;
  html: string | null;
  thumbnail: string | null;
  isStandalone: boolean;
  projectId: string | null;
  updatedAt: string;
  project: { id: string; name: string } | null;
}

type FilterTab = "all" | "standalone" | "project";

/* ─── Animation variants ─────────────────────────────────────────────────── */

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

/* ─── Date formatter ─────────────────────────────────────────────────────── */

function formatRelativeDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Designs content                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function DesignsContent() {
  const router = useRouter();

  // Data state
  const [designs, setDesigns] = useState<DesignItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [standaloneCount, setStandaloneCount] = useState(0);
  const [maxDesigns, setMaxDesigns] = useState<number>(-1);

  // Tab filter
  const [filter, setFilter] = useState<FilterTab>("all");

  // Rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<DesignItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upgrade modal
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  // ─── Fetch designs ──────────────────────────────────────────────────

  const fetchDesigns = useCallback(async (f: FilterTab) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/designs?filter=${f}`);
      if (res.ok) {
        const data = await res.json();
        setDesigns(data.items);
        setStandaloneCount(data.standaloneCount);
        setMaxDesigns(data.maxDesigns);
      }
    } catch {
      toast.error("Failed to load designs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDesigns(filter);
  }, [filter, fetchDesigns]);

  // ─── Actions ────────────────────────────────────────────────────────

  async function handleNewDesign() {
    if (maxDesigns >= 0 && standaloneCount >= maxDesigns) {
      setUpgradeMessage(
        `You've reached your limit of ${maxDesigns} saved designs. Upgrade your plan for unlimited designs.`,
      );
      setUpgradeOpen(true);
      return;
    }

    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Design" }),
      });

      if (res.status === 403) {
        const data = await res.json();
        setUpgradeMessage(data.message);
        setUpgradeOpen(true);
        return;
      }

      if (!res.ok) {
        toast.error("Failed to create design.");
        return;
      }

      const design = await res.json();
      router.push(`/design/${design.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  async function handleRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) return;

    try {
      const res = await fetch(`/api/designs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (res.ok) {
        setDesigns((prev) =>
          prev.map((d) => (d.id === id ? { ...d, name: trimmed } : d)),
        );
        toast.success("Design renamed.");
      } else {
        toast.error("Failed to rename design.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setRenamingId(null);
      setRenameValue("");
    }
  }

  async function handleDuplicate(design: DesignItem) {
    try {
      const res = await fetch("/api/designs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `${design.name} (copy)` }),
      });

      if (res.status === 403) {
        const data = await res.json();
        setUpgradeMessage(data.message);
        setUpgradeOpen(true);
        return;
      }

      if (res.ok) {
        toast.success("Design duplicated.");
        fetchDesigns(filter);
      } else {
        toast.error("Failed to duplicate design.");
      }
    } catch {
      toast.error("Something went wrong.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/designs/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setDesigns((prev) => prev.filter((d) => d.id !== deleteTarget.id));
        if (deleteTarget.isStandalone) {
          setStandaloneCount((prev) => prev - 1);
        }
        toast.success("Design deleted.");
      } else {
        toast.error("Failed to delete design.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  async function handleUpgradeToProject(design: DesignItem) {
    try {
      const res = await fetch(`/api/designs/${design.id}/upgrade`, {
        method: "POST",
      });

      if (res.status === 403) {
        const data = await res.json();
        setUpgradeMessage(data.message);
        setUpgradeOpen(true);
        return;
      }

      if (!res.ok) {
        toast.error("Failed to upgrade design to project.");
        return;
      }

      const data = await res.json();
      toast.success(`Created project "${data.projectName}"`);
      router.push(`/project/${data.projectId}`);
    } catch {
      toast.error("Something went wrong.");
    }
  }

  function startRename(design: DesignItem) {
    setRenamingId(design.id);
    setRenameValue(design.name);
  }

  // ─── Render ─────────────────────────────────────────────────────────

  const limitDisplay =
    maxDesigns >= 0
      ? `${standaloneCount} / ${maxDesigns} standalone designs used`
      : null;

  return (
    <>
      <div className="px-4 pb-16 pt-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Designs</h1>
            {!loading && limitDisplay && (
              <p className="mt-1 text-sm text-muted-foreground">
                {limitDisplay}
              </p>
            )}
          </div>
          <Button onClick={handleNewDesign} size="sm">
            <Paintbrush className="size-4" />
            New Design
          </Button>
        </div>

        {/* Tabs / Filter */}
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as FilterTab)}
          className="mt-6"
        >
          <TabsList variant="line">
            <TabsTrigger value="all">All Designs</TabsTrigger>
            <TabsTrigger value="standalone">Standalone</TabsTrigger>
            <TabsTrigger value="project">Project Designs</TabsTrigger>
          </TabsList>

          <TabsContent value={filter} className="mt-6">
            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-[16/10] w-full rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                ))}
              </div>
            ) : designs.length === 0 ? (
              <EmptyState filter={filter} onNew={handleNewDesign} />
            ) : (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={staggerContainer}
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              >
                {designs.map((design) => (
                  <motion.div key={design.id} variants={staggerItem}>
                    <DesignGridCard
                      design={design}
                      isRenaming={renamingId === design.id}
                      renameValue={renameValue}
                      onRenameValueChange={setRenameValue}
                      onStartRename={() => startRename(design)}
                      onConfirmRename={() => handleRename(design.id)}
                      onCancelRename={() => {
                        setRenamingId(null);
                        setRenameValue("");
                      }}
                      onDuplicate={() => handleDuplicate(design)}
                      onDelete={() => setDeleteTarget(design)}
                      onUpgradeToProject={() => handleUpgradeToProject(design)}
                    />
                  </motion.div>
                ))}
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete design?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; will be permanently deleted.
              This action cannot be undone.
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
        feature={upgradeMessage}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Empty state                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function EmptyState({
  filter,
  onNew,
}: {
  filter: FilterTab;
  onNew: () => void;
}) {
  const config = {
    all: {
      title: "No designs yet",
      description:
        "Designs let you create beautiful pages with AI-powered generation.",
      showCta: true,
    },
    standalone: {
      title: "No standalone designs",
      description:
        "Standalone designs live outside of projects — perfect for quick experiments and one-off pages.",
      showCta: true,
    },
    project: {
      title: "No project designs",
      description:
        "Project designs are created as part of a project workflow. Start a new project to create designs within it.",
      showCta: false,
    },
  }[filter];

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-muted">
        <Palette className="size-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-base font-medium">{config.title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {config.description}
      </p>
      {config.showCta && (
        <Button onClick={onNew} size="sm" className="mt-5">
          <Paintbrush className="size-4" />
          Create Your First Design
        </Button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Design Grid Card                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface DesignGridCardProps {
  design: DesignItem;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (v: string) => void;
  onStartRename: () => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUpgradeToProject: () => void;
}

function DesignGridCard({
  design,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onDuplicate,
  onDelete,
  onUpgradeToProject,
}: DesignGridCardProps) {
  const href = design.isStandalone
    ? `/design/${design.id}`
    : `/project/${design.projectId}`;

  const cardContent = (
    <Card className="group overflow-hidden transition-colors hover:border-primary/50">
      {/* Thumbnail */}
      {design.thumbnail ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          <Image
            src={design.thumbnail}
            alt={design.name}
            fill
            className="object-cover"
          />
        </div>
      ) : design.html && design.html.length > 0 ? (
        <div className="aspect-[16/10] w-full overflow-hidden">
          <HtmlPreview html={design.html} />
        </div>
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted/50">
          <div className="text-2xl font-bold text-muted-foreground/20">
            {design.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      <CardHeader className="p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          {isRenaming ? (
            <div
              className="flex flex-1 items-center gap-1"
              onClick={(e) => e.preventDefault()}
            >
              <Input
                value={renameValue}
                onChange={(e) => onRenameValueChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onConfirmRename();
                  if (e.key === "Escape") onCancelRename();
                }}
                className="h-7 text-sm"
                autoFocus
              />
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onConfirmRename();
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Check className="size-3.5" />
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onCancelRename();
                }}
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ) : (
            <>
              <CardTitle className="truncate text-sm">{design.name}</CardTitle>
              <div className="flex shrink-0 items-center gap-1">
                <Badge
                  variant={design.isStandalone ? "outline" : "secondary"}
                  className="text-[10px]"
                >
                  {design.isStandalone
                    ? "Standalone"
                    : design.project?.name ?? "Project"}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.preventDefault()}
                      className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
                    >
                      <MoreHorizontal className="size-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        onStartRename();
                      }}
                    >
                      <Pencil className="size-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        onDuplicate();
                      }}
                    >
                      <Copy className="size-4" />
                      Duplicate
                    </DropdownMenuItem>
                    {design.isStandalone && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            onUpgradeToProject();
                          }}
                        >
                          <FolderPlus className="size-4" />
                          Upgrade to Project
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        onDelete();
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="size-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-3 pb-3">
        <p className="text-[10px] text-muted-foreground/70">
          {formatRelativeDate(design.updatedAt)}
        </p>
      </CardContent>
    </Card>
  );

  if (isRenaming) {
    return <div className="block">{cardContent}</div>;
  }

  return (
    <Link href={href} className="block">
      {cardContent}
    </Link>
  );
}
