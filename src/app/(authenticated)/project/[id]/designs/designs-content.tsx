"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Sparkles,
  Star,
  Loader2,
  Palette,
  Wand2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  useProjectStore,
  type ProjectPage,
  type ProjectDesign,
} from "@/stores/project-store";
import { HtmlPreview } from "@/components/features/html-preview";
import { cn } from "@/lib/utils";

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

/* ─── Helpers ────────────────────────────────────────────────────────────── */

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
  const {
    project,
    pages,
    designs,
    loading,
    designGenerating: generating,
    designGenProgress: genProgress,
    designGenTotal: genTotal,
    designGenCurrentPageName: genPageName,
    designGenProjectId: genProjectId,
    generateAllDesigns,
    resumeDesignGeneration,
  } = useProjectStore();
  const router = useRouter();

  // Map pages to their designs
  const pageDesignMap = useMemo(() => {
    const map = new Map<string, ProjectDesign>();
    for (const design of designs) {
      if (design.pageId) {
        map.set(design.pageId, design);
      }
    }
    return map;
  }, [designs]);

  // Style guide
  const styleGuide = useMemo(
    () => designs.find((d) => d.isStyleGuide) ?? null,
    [designs],
  );

  const styleGuidePage = useMemo(() => {
    if (!styleGuide?.pageId) return null;
    return pages.find((p) => p.id === styleGuide.pageId) ?? null;
  }, [styleGuide, pages]);

  // Pages without designs
  const pagesWithoutDesign = useMemo(
    () => pages.filter((p) => !pageDesignMap.has(p.id)),
    [pages, pageDesignMap],
  );

  // Lazy-load design HTML (excluded from initial project fetch for speed)
  const [designHtmlMap, setDesignHtmlMap] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!project || designs.length === 0) return;
    // If designs already have HTML loaded (from store), use them
    const alreadyLoaded = designs.some((d) => d.html && d.html.length > 0);
    if (alreadyLoaded) return;

    // Fetch design HTML for this project's designs
    let cancelled = false;
    async function loadHtml() {
      try {
        const res = await fetch(`/api/projects/${project!.id}/designs/html`);
        if (!res.ok || cancelled) return;
        const data: { id: string; html: string }[] = await res.json();
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const d of data) {
          if (d.html && d.html.length > 0) map.set(d.id, d.html);
        }
        setDesignHtmlMap(map);
      } catch {
        // Non-critical — cards will show placeholder
      }
    }
    loadHtml();
    return () => { cancelled = true; };
  }, [project, designs]);

  // Auto-resume batch generation on mount (handles page refresh / navigation back)
  useEffect(() => {
    if (!loading && project) {
      resumeDesignGeneration();
    }
  }, [loading, project, resumeDesignGeneration]);

  // ─── Navigate to design editor ────────────────────────────────────

  function handleCardClick(pageId: string) {
    if (!project) return;
    router.push(`/project/${project.id}/designs/${pageId}`);
  }

  // ─── Batch generate ───────────────────────────────────────────────

  const handleGenerateAll = generateAllDesigns;

  // ─── Render ─────────────────────────────────────────────────────────

  if (loading || !project) {
    return (
      <div className="p-6 sm:p-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Designs</h1>
          {styleGuide && styleGuidePage && (
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/30 bg-amber-500/5 text-amber-600"
            >
              <Star className="size-3 fill-amber-500 text-amber-500" />
              Style Guide: {styleGuidePage.title}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pagesWithoutDesign.length > 0 && !generating && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateAll}
            >
              <Sparkles className="size-4" />
              Generate All ({pagesWithoutDesign.length})
            </Button>
          )}
        </div>
      </div>

      {/* Batch generation progress */}
      {generating && genTotal > 0 && genProjectId === project.id && (
        <div className="mb-6 rounded-xl border border-border/60 bg-muted/30 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="flex items-center gap-2 font-medium">
              <Loader2 className="size-4 animate-spin" />
              {genPageName
                ? `Generating: ${genPageName}...`
                : "Generating designs..."}
            </span>
            <span className="text-muted-foreground">
              {genProgress} / {genTotal}
            </span>
          </div>
          <Progress
            value={(genProgress / genTotal) * 100}
            className="h-2"
          />
        </div>
      )}

      {/* Empty state — no pages */}
      {pages.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Palette className="size-6 text-muted-foreground" />
          </div>
          <p className="mt-4 text-base font-medium">No pages to design</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Add pages in the Pages &amp; Content step first, then come back here
            to create designs for each page.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-5"
            onClick={() => router.push(`/project/${project.id}/pages`)}
          >
            Go to Pages
          </Button>
        </div>
      )}

      {/* Design cards grid */}
      {pages.length > 0 && (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {pages.map((page) => {
            const design = pageDesignMap.get(page.id);
            // Use lazy-loaded HTML if the store doesn't have it
            const html = design
              ? (design.html && design.html.length > 0
                  ? design.html
                  : designHtmlMap.get(design.id) ?? "")
              : "";
            return (
              <motion.div key={page.id} variants={staggerItem}>
                <DesignCard
                  page={page}
                  design={design ? { ...design, html } : null}
                  isStyleGuide={design?.isStyleGuide ?? false}
                  onClick={() => handleCardClick(page.id)}
                />
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Design Card                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function DesignCard({
  page,
  design,
  isStyleGuide,
  onClick,
}: {
  page: ProjectPage;
  design: ProjectDesign | null;
  isStyleGuide: boolean;
  onClick: () => void;
}) {
  const hasDesign = design && design.html.length > 0;

  return (
    <Card
      className={cn(
        "group cursor-pointer overflow-hidden transition-all hover:shadow-md",
        isStyleGuide
          ? "border-amber-500/40 ring-1 ring-amber-500/20 hover:border-amber-500/60"
          : "hover:border-primary/50",
      )}
      onClick={onClick}
    >
      {/* Thumbnail area */}
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted/50">
        {hasDesign && design.thumbnail ? (
          <Image
            src={design.thumbnail}
            alt={`${page.title} design`}
            fill
            className="object-cover object-top transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : hasDesign ? (
          <HtmlPreview html={design.html} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/50">
            <Wand2 className="size-8" />
            <span className="text-xs font-medium">Click to design</span>
          </div>
        )}

        {/* Style guide star */}
        {isStyleGuide && (
          <div className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-amber-500 shadow-sm">
            <Star className="size-3.5 fill-white text-white" />
          </div>
        )}
      </div>

      {/* Card footer */}
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{page.title}</p>
          {hasDesign && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock className="size-3" />
              {formatRelativeDate(design.updatedAt)}
            </p>
          )}
        </div>
        {isStyleGuide && (
          <Badge
            variant="outline"
            className="shrink-0 border-amber-500/30 bg-amber-500/5 text-[10px] text-amber-600"
          >
            Style Guide
          </Badge>
        )}
      </div>
    </Card>
  );
}

