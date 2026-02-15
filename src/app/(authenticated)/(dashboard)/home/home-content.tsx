"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FolderPlus,
  Paintbrush,
  Send,
  Loader2,
  ArrowRight,
  FolderKanban,
  Palette,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { NetworkGraph } from "@/components/features/network-graph";
import { UpgradeModal } from "@/components/features/upgrade-modal";
import { ProjectCard } from "@/components/features/project-card";
import { DesignCard } from "@/components/features/design-card";
import { useCurrentUser } from "@/hooks/useAuth";
import { canCreateProject, type Plan } from "@/lib/plan-limits";
import { cn } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type RecentItem =
  | {
      type: "project";
      id: string;
      name: string;
      description: string | null;
      thumbnail: string | null;
      currentStep: string;
      updatedAt: string;
    }
  | {
      type: "design";
      id: string;
      name: string;
      thumbnail: string | null;
      updatedAt: string;
    };

type Tab = "all" | "projects" | "designs";

/* ─── Animation variants ─────────────────────────────────────────────────── */

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
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

/* ─── Suggestion chips ───────────────────────────────────────────────────── */

const SUGGESTION_CHIPS = [
  { label: "Create a project", text: "Create a new project" },
  { label: "Create a design", text: "Create a new standalone design" },
  { label: "Surprise me", text: "Surprise me with a creative project idea" },
];

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
/*  Home content                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function HomeContent() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useCurrentUser();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Chat state
  const [chatInput, setChatInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Upgrade modal
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  // Recents
  const [tab, setTab] = useState<Tab>("all");
  const [recents, setRecents] = useState<RecentItem[]>([]);
  const [recentsLoading, setRecentsLoading] = useState(true);
  const recentsCache = useRef<Partial<Record<Tab, RecentItem[]>>>({});

  // ─── Fetch recents ────────────────────────────────────────────────────

  const fetchRecents = useCallback(async (t: Tab) => {
    if (recentsCache.current[t]) {
      setRecents(recentsCache.current[t]!);
      setRecentsLoading(false);
      return;
    }

    setRecentsLoading(true);
    try {
      const res = await fetch(`/api/recents?tab=${t}&limit=8`);
      if (res.ok) {
        const data = await res.json();
        setRecents(data.items);
        recentsCache.current[t] = data.items;
      }
    } catch {
      // Silently fail — empty state will show
    } finally {
      setRecentsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecents(tab);
  }, [tab, fetchRecents]);

  // ─── Project creation ─────────────────────────────────────────────────

  async function createProject(name: string, description?: string) {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });

    if (res.status === 403) {
      const data = await res.json();
      setUpgradeMessage(data.message);
      setUpgradeOpen(true);
      return;
    }

    if (!res.ok) {
      toast.error("Failed to create project. Please try again.");
      return;
    }

    const project = await res.json();
    router.push(`/project/${project.id}`);
  }

  // ─── Design creation ──────────────────────────────────────────────────

  async function createDesign(name: string) {
    const res = await fetch("/api/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    if (res.status === 403) {
      const data = await res.json();
      setUpgradeMessage(data.message);
      setUpgradeOpen(true);
      return;
    }

    if (!res.ok) {
      toast.error("Failed to create design. Please try again.");
      return;
    }

    const design = await res.json();
    router.push(`/design/${design.id}`);
  }

  // ─── Chat submit ──────────────────────────────────────────────────────

  async function handleChatSubmit(text?: string) {
    const message = (text ?? chatInput).trim();
    if (!message || isProcessing) return;

    setIsProcessing(true);

    try {
      const res = await fetch("/api/chat/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) {
        toast.error("Something went wrong. Please try again.");
        return;
      }

      const data = await res.json();

      switch (data.intent) {
        case "new_project":
          setChatInput("");
          await createProject(
            data.name || "Untitled Project",
            data.description,
          );
          break;
        case "new_design":
          setChatInput("");
          await createDesign(data.name || "Untitled Design");
          break;
        case "general":
          toast.info(
            data.message ||
              "Try describing a project or design you'd like to create!",
          );
          break;
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSubmit();
    }
  }

  // ─── Quick action handlers ────────────────────────────────────────────

  function handleNewProject() {
    const plan = (user?.plan ?? "free") as Plan;
    if (!canCreateProject(plan)) {
      setUpgradeMessage(
        "Projects are not available on the Free plan. Upgrade to Studio or higher to create projects.",
      );
      setUpgradeOpen(true);
      return;
    }
    createProject("Untitled Project");
  }

  function handleNewDesign() {
    createDesign("Untitled Design");
  }

  // ─── Render ───────────────────────────────────────────────────────────

  const firstName = user?.name?.split(" ")[0] ?? "there";

  return (
    <>
      <div className="px-4 pb-16 sm:px-6">
        {/* ── Hero — network graph + content ──────────────────────────── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="mx-auto flex max-w-6xl items-center justify-center gap-12 py-10 lg:gap-20 lg:py-16"
        >
          {/* Network graph (left side, hidden on small screens) */}
          <motion.div
            variants={staggerItem}
            className="hidden shrink-0 lg:block"
            style={{ width: 420, height: 420 }}
          >
            <NetworkGraph isTalking={isProcessing} />
          </motion.div>

          {/* Content (right side) */}
          <div className="flex max-w-xl flex-1 flex-col">
            {/* Greeting */}
            <motion.div variants={staggerItem} className="flex items-start gap-3">
              <span className="mt-2 text-xl text-muted-foreground">—</span>
              <div>
                <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  {authLoading ? (
                    <Skeleton className="h-10 w-64" />
                  ) : (
                    <>Welcome back, {firstName}!</>
                  )}
                </h1>
                <p className="mt-1 text-base text-muted-foreground">
                  What shall we make today?
                </p>
              </div>
            </motion.div>

            {/* Suggestion chips */}
            <motion.div
              variants={staggerItem}
              className="ml-8 mt-5 flex flex-wrap gap-2"
            >
              {SUGGESTION_CHIPS.map((chip) => (
                <button
                  key={chip.label}
                  onClick={() => handleChatSubmit(chip.text)}
                  disabled={isProcessing}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground/80 transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
                >
                  {chip.label}
                </button>
              ))}
            </motion.div>

            {/* Chat input */}
            <motion.div variants={staggerItem} className="ml-8 mt-4">
              <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
                <textarea
                  ref={textareaRef}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your vision..."
                  disabled={isProcessing}
                  rows={1}
                  className={cn(
                    "w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm",
                    "placeholder:text-muted-foreground/60",
                    "focus:outline-none",
                    "disabled:opacity-60",
                    "min-h-[48px] max-h-[120px]",
                  )}
                  style={{ fieldSizing: "content" } as React.CSSProperties}
                />
                <button
                  onClick={() => handleChatSubmit()}
                  disabled={!chatInput.trim() || isProcessing}
                  className={cn(
                    "absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-lg transition-colors",
                    chatInput.trim() && !isProcessing
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-muted-foreground/40",
                  )}
                >
                  {isProcessing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </button>
              </div>
            </motion.div>

            {/* Action buttons */}
            <motion.div
              variants={staggerItem}
              className="ml-8 mt-4 flex gap-3"
            >
              <Button
                onClick={handleNewProject}
                disabled={isProcessing}
                className="flex-1"
              >
                <FolderPlus className="size-4" />
                New Project +
              </Button>
              <Button
                variant="outline"
                onClick={handleNewDesign}
                disabled={isProcessing}
                className="flex-1"
              >
                <Paintbrush className="size-4" />
                New Design +
              </Button>
            </motion.div>
          </div>
        </motion.div>

        {/* ── Recents Section ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            delay: 0.4,
            duration: 0.5,
            ease: [0.25, 0.4, 0, 1] as [number, number, number, number],
          }}
          className="mx-auto max-w-6xl"
        >
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Recents
              </h2>
              <TabsList variant="line">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="projects">Projects</TabsTrigger>
                <TabsTrigger value="designs">Designs</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value={tab} className="mt-4">
              {recentsLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="aspect-[16/10] w-full rounded-lg" />
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : recents.length === 0 ? (
                <EmptyState tab={tab} />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {recents.slice(0, 7).map((item) =>
                    item.type === "project" ? (
                      <ProjectCard
                        key={item.id}
                        id={item.id}
                        name={item.name}
                        description={item.description}
                        thumbnail={item.thumbnail}
                        updatedAt={formatRelativeDate(item.updatedAt)}
                      />
                    ) : (
                      <DesignCard
                        key={item.id}
                        id={item.id}
                        name={item.name}
                        thumbnail={item.thumbnail}
                        updatedAt={formatRelativeDate(item.updatedAt)}
                      />
                    ),
                  )}
                  {recents.length >= 7 && (
                    <ViewAllCard tab={tab} />
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature={upgradeMessage}
      />
    </>
  );
}

/* ─── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({ tab }: { tab: Tab }) {
  const config = {
    all: {
      icon: Clock,
      title: "No recent items yet",
      description: "Create a project or design to get started.",
    },
    projects: {
      icon: FolderKanban,
      title: "No projects yet",
      description:
        "Start your first project to go from idea to production-ready app.",
    },
    designs: {
      icon: Palette,
      title: "No designs yet",
      description: "Create a standalone design in the Design Studio.",
    },
  }[tab];

  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="mt-4 text-sm font-medium">{config.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {config.description}
      </p>
    </div>
  );
}

/* ─── View All card ──────────────────────────────────────────────────────── */

function ViewAllCard({ tab }: { tab: Tab }) {
  const href =
    tab === "designs" ? "/designs" : tab === "projects" ? "/projects" : "/projects";

  return (
    <Link
      href={href}
      className="group flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 transition-colors hover:border-primary/40 hover:bg-primary/[0.02]"
      style={{ minHeight: 180 }}
    >
      <ArrowRight className="size-5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      <span className="mt-2 text-sm font-medium text-muted-foreground group-hover:text-primary">
        View All
      </span>
    </Link>
  );
}
