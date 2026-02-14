"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  FolderPlus,
  FolderKanban,
  MoreHorizontal,
  Pencil,
  Copy,
  Archive,
  Trash2,
  ArrowUpDown,
  Clock,
  ArrowDownAZ,
  ArrowUpAZ,
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
import { useCurrentUser } from "@/hooks/useAuth";
import { canCreateProject, type Plan } from "@/lib/plan-limits";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  currentStep: string;
  status: string;
  updatedAt: string;
}

type SortOption = "recent" | "name_asc" | "name_desc";

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
/*  Projects content                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ProjectsContent() {
  const router = useRouter();
  const { user } = useCurrentUser();

  // Data state
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [maxProjects, setMaxProjects] = useState(0);

  // Sort
  const [sort, setSort] = useState<SortOption>("recent");

  // Rename
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<ProjectItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Upgrade modal
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  // ─── Fetch projects ─────────────────────────────────────────────────

  const fetchProjects = useCallback(async (sortBy: SortOption) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects?sort=${sortBy}&status=active`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.items);
        setTotal(data.total);
        setMaxProjects(data.maxProjects);
      }
    } catch {
      toast.error("Failed to load projects.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects(sort);
  }, [sort, fetchProjects]);

  // ─── Actions ────────────────────────────────────────────────────────

  async function handleNewProject() {
    const plan = (user?.plan ?? "free") as Plan;
    if (!canCreateProject(plan)) {
      setUpgradeMessage(
        "Projects are not available on the Free plan. Upgrade to Studio or higher to create projects.",
      );
      setUpgradeOpen(true);
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Untitled Project" }),
      });

      if (res.status === 403) {
        const data = await res.json();
        setUpgradeMessage(data.message);
        setUpgradeOpen(true);
        return;
      }

      if (!res.ok) {
        toast.error("Failed to create project.");
        return;
      }

      const project = await res.json();
      router.push(`/project/${project.id}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
  }

  async function handleRename(id: string) {
    const trimmed = renameValue.trim();
    if (!trimmed) return;

    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });

      if (res.ok) {
        setProjects((prev) =>
          prev.map((p) => (p.id === id ? { ...p, name: trimmed } : p)),
        );
        toast.success("Project renamed.");
      } else {
        toast.error("Failed to rename project.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setRenamingId(null);
      setRenameValue("");
    }
  }

  async function handleDuplicate(project: ProjectItem) {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${project.name} (copy)`,
          description: project.description,
        }),
      });

      if (res.status === 403) {
        const data = await res.json();
        setUpgradeMessage(data.message);
        setUpgradeOpen(true);
        return;
      }

      if (res.ok) {
        toast.success("Project duplicated.");
        fetchProjects(sort);
      } else {
        toast.error("Failed to duplicate project.");
      }
    } catch {
      toast.error("Something went wrong.");
    }
  }

  async function handleArchive(id: string) {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });

      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        setTotal((prev) => prev - 1);
        toast.success("Project archived.");
      } else {
        toast.error("Failed to archive project.");
      }
    } catch {
      toast.error("Something went wrong.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/projects/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id));
        setTotal((prev) => prev - 1);
        toast.success("Project deleted.");
      } else {
        toast.error("Failed to delete project.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  function startRename(project: ProjectItem) {
    setRenamingId(project.id);
    setRenameValue(project.name);
  }

  // ─── Sort labels ───────────────────────────────────────────────────

  const sortOptions: { value: SortOption; label: string; icon: typeof Clock }[] =
    [
      { value: "recent", label: "Most Recent", icon: Clock },
      { value: "name_asc", label: "Name A–Z", icon: ArrowDownAZ },
      { value: "name_desc", label: "Name Z–A", icon: ArrowUpAZ },
    ];

  const currentSort = sortOptions.find((s) => s.value === sort)!;

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <>
      <div className="px-4 pb-16 pt-8 sm:px-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
            {!loading && maxProjects !== Infinity && maxProjects > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {total} / {maxProjects} projects used
              </p>
            )}
          </div>
          <Button onClick={handleNewProject} size="sm">
            <FolderPlus className="size-4" />
            New Project
          </Button>
        </div>

        {/* Sort controls */}
        {!loading && projects.length > 0 && (
          <div className="mt-6 flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <ArrowUpDown className="size-3.5" />
                  {currentSort.label}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {sortOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setSort(option.value)}
                    >
                      <Icon className="size-4" />
                      {option.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Grid / Loading / Empty */}
        <div className="mt-6">
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
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted">
                <FolderKanban className="size-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-base font-medium">No projects yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Projects let you go from idea to production-ready app with
                AI-powered features, user flows, pages, and designs.
              </p>
              <Button
                onClick={handleNewProject}
                size="sm"
                className="mt-5"
              >
                <FolderPlus className="size-4" />
                Create Your First Project
              </Button>
            </div>
          ) : (
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            >
              {projects.map((project) => (
                <motion.div key={project.id} variants={staggerItem}>
                  <ProjectGridCard
                    project={project}
                    isRenaming={renamingId === project.id}
                    renameValue={renameValue}
                    onRenameValueChange={setRenameValue}
                    onStartRename={() => startRename(project)}
                    onConfirmRename={() => handleRename(project.id)}
                    onCancelRename={() => {
                      setRenamingId(null);
                      setRenameValue("");
                    }}
                    onDuplicate={() => handleDuplicate(project)}
                    onArchive={() => handleArchive(project.id)}
                    onDelete={() => setDeleteTarget(project)}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{deleteTarget?.name}&rdquo; will be archived and no longer
              visible. This action can be undone from settings.
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
/*  Project Grid Card                                                        */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface ProjectGridCardProps {
  project: ProjectItem;
  isRenaming: boolean;
  renameValue: string;
  onRenameValueChange: (v: string) => void;
  onStartRename: () => void;
  onConfirmRename: () => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

function ProjectGridCard({
  project,
  isRenaming,
  renameValue,
  onRenameValueChange,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onDuplicate,
  onArchive,
  onDelete,
}: ProjectGridCardProps) {
  const cardContent = (
    <Card className="group overflow-hidden transition-colors hover:border-primary/50">
      {/* Thumbnail */}
      {project.thumbnail ? (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          <Image
            src={project.thumbnail}
            alt={project.name}
            fill
            className="object-cover"
          />
        </div>
      ) : (
        <div className="flex aspect-[16/10] w-full items-center justify-center bg-muted/50">
          <div className="text-2xl font-bold text-muted-foreground/20">
            {project.name.charAt(0).toUpperCase()}
          </div>
        </div>
      )}

      <CardHeader className="p-3 pb-1">
        <div className="flex items-start justify-between gap-2">
          {isRenaming ? (
            <div className="flex flex-1 items-center gap-1" onClick={(e) => e.preventDefault()}>
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
              <CardTitle className="truncate text-sm">{project.name}</CardTitle>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant="secondary" className="text-[10px]">
                  {project.currentStep}
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
                  <DropdownMenuContent align="end" className="w-40">
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
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        onArchive();
                      }}
                    >
                      <Archive className="size-4" />
                      Archive
                    </DropdownMenuItem>
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
        {project.description && (
          <p className="truncate text-xs text-muted-foreground">
            {project.description}
          </p>
        )}
        <p
          className={cn(
            "text-[10px] text-muted-foreground/70",
            project.description && "mt-1",
          )}
        >
          {formatRelativeDate(project.updatedAt)}
        </p>
      </CardContent>
    </Card>
  );

  if (isRenaming) {
    return <div className="block">{cardContent}</div>;
  }

  return (
    <Link href={`/project/${project.id}`} className="block">
      {cardContent}
    </Link>
  );
}
