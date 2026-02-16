"use client";

import { useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Lightbulb,
  GitBranch,
  FileText,
  Palette,
  Hammer,
  ArrowRight,
  Check,
  Circle,
  X,
  Pencil,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProjectStore, type ProjectStep } from "@/stores/project-store";
import { useProjectContext } from "@/components/layout/ProjectLayout";
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

/* ─── Step config ────────────────────────────────────────────────────────── */

const stepConfig: {
  key: ProjectStep;
  label: string;
  icon: typeof Lightbulb;
}[] = [
  { key: "features", label: "Features", icon: Lightbulb },
  { key: "flows", label: "User Flows", icon: GitBranch },
  { key: "pages", label: "Pages", icon: FileText },
  { key: "designs", label: "Designs", icon: Palette },
  { key: "build", label: "Build", icon: Hammer },
];

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Project Overview                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ProjectOverview() {
  const { setActiveStep } = useProjectContext();
  const {
    project,
    features,
    userFlows,
    pages,
    designs,
    buildConfig,
    loading,
    updateProject,
  } = useProjectStore();

  // Inline editing
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [descValue, setDescValue] = useState("");

  if (loading || !project) {
    return (
      <div className="p-6 sm:p-8">
        <Skeleton className="mb-2 h-9 w-72" />
        <Skeleton className="mb-8 h-5 w-96" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ─── Step completion ─────────────────────────────────────────────────

  const stepData: Record<string, { count: number; total?: number }> = {
    features: { count: features.length },
    flows: { count: userFlows.length },
    pages: { count: pages.length },
    designs: {
      count: designs.length,
      total: pages.length > 0 ? pages.length : undefined,
    },
    build: { count: buildConfig ? 1 : 0 },
  };

  function isStepComplete(key: string) {
    return stepData[key].count > 0;
  }

  // ─── Inline editing handlers ─────────────────────────────────────────

  function startEditName() {
    setNameValue(project!.name);
    setEditingName(true);
  }

  function startEditDesc() {
    setDescValue(project!.description ?? "");
    setEditingDesc(true);
  }

  async function saveName() {
    const trimmed = nameValue.trim();
    if (!trimmed || trimmed === project!.name) {
      setEditingName(false);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${project!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        updateProject({ name: trimmed });
        toast.success("Project name updated.");
      } else {
        toast.error("Failed to update name.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setEditingName(false);
    }
  }

  async function saveDesc() {
    const trimmed = descValue.trim();
    if (trimmed === (project!.description ?? "")) {
      setEditingDesc(false);
      return;
    }

    try {
      const res = await fetch(`/api/projects/${project!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: trimmed || null }),
      });
      if (res.ok) {
        updateProject({ description: trimmed || null });
        toast.success("Description updated.");
      } else {
        toast.error("Failed to update description.");
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setEditingDesc(false);
    }
  }

  function handleStepClick(step: ProjectStep) {
    setActiveStep(step);
  }

  // ─── Style guide ────────────────────────────────────────────────────

  const styleGuide = designs.find((d) => d.isStyleGuide);

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={staggerContainer}
      className="p-6 sm:p-8"
    >
      {/* Project name (editable) */}
      <motion.div variants={staggerItem}>
        {editingName ? (
          <div className="mb-1 flex items-center gap-2">
            <Input
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") setEditingName(false);
              }}
              className="h-10 max-w-md text-2xl font-semibold"
              autoFocus
            />
            <button
              onClick={saveName}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Check className="size-4" />
            </button>
            <button
              onClick={() => setEditingName(false)}
              className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="group mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {project.name}
            </h1>
            <button
              onClick={startEditName}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
            >
              <Pencil className="size-3.5" />
            </button>
          </div>
        )}
      </motion.div>

      {/* Description (editable) */}
      <motion.div variants={staggerItem} className="mb-8">
        {editingDesc ? (
          <div className="flex items-start gap-2">
            <Textarea
              value={descValue}
              onChange={(e) => setDescValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  saveDesc();
                }
                if (e.key === "Escape") setEditingDesc(false);
              }}
              className="max-w-lg text-sm"
              rows={2}
              autoFocus
              placeholder="Add a project description..."
            />
            <button
              onClick={saveDesc}
              className="mt-1 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Check className="size-4" />
            </button>
            <button
              onClick={() => setEditingDesc(false)}
              className="mt-1 flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ) : (
          <div className="group flex items-center gap-2">
            <p
              className={cn(
                "text-sm",
                project.description
                  ? "text-muted-foreground"
                  : "cursor-pointer text-muted-foreground/50 italic",
              )}
              onClick={!project.description ? startEditDesc : undefined}
            >
              {project.description || "Add a description..."}
            </p>
            {project.description && (
              <button
                onClick={startEditDesc}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
              >
                <Pencil className="size-3" />
              </button>
            )}
          </div>
        )}
      </motion.div>

      {/* Progress indicator */}
      <motion.div variants={staggerItem} className="mb-8">
        <div className="flex items-center gap-1">
          {stepConfig.map((step, i) => {
            const complete = isStepComplete(step.key);
            const data = stepData[step.key];
            const isCurrent = project.currentStep === step.key;

            return (
              <div key={step.key} className="flex items-center">
                {i > 0 && (
                  <div
                    className={cn(
                      "mx-1 h-px w-6 sm:w-10",
                      complete ? "bg-primary" : "bg-border",
                    )}
                  />
                )}
                <button
                  onClick={() => handleStepClick(step.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                    isCurrent
                      ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                      : complete
                        ? "bg-muted text-foreground"
                        : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  {complete ? (
                    <Check className="size-3" />
                  ) : (
                    <Circle className="size-3" />
                  )}
                  <span className="hidden sm:inline">{step.label}</span>
                  {data.total ? (
                    <span className="text-[10px] text-muted-foreground">
                      {data.count}/{data.total}
                    </span>
                  ) : data.count > 0 ? (
                    <span className="text-[10px] text-muted-foreground">
                      {data.count}
                    </span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Continue CTA — only if any step has been started */}
      {Object.values(stepData).some((d) => d.count > 0) && (
        <motion.div variants={staggerItem} className="mb-8">
          <Button
            onClick={() => handleStepClick(project.currentStep as ProjectStep)}
            size="sm"
          >
            Continue where you left off
            <ArrowRight className="size-4" />
          </Button>
        </motion.div>
      )}

      {/* Quick stats + Step cards */}
      <motion.div
        variants={staggerContainer}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
      >
        {stepConfig.map((step) => {
          const Icon = step.icon;
          const data = stepData[step.key];
          const complete = isStepComplete(step.key);

          return (
            <motion.div key={step.key} variants={staggerItem}>
              <Card
                className={cn(
                  "cursor-pointer transition-colors hover:border-primary/50",
                  complete && "border-primary/20",
                )}
                onClick={() => handleStepClick(step.key)}
              >
                <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                  <div
                    className={cn(
                      "flex size-9 items-center justify-center rounded-lg",
                      complete
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm">{step.label}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {data.count > 0
                        ? data.total
                          ? `${data.count} of ${data.total} complete`
                          : `${data.count} ${step.label.toLowerCase()}`
                        : "Not started"}
                    </p>
                  </div>
                  <ArrowRight className="size-4 text-muted-foreground/50" />
                </CardHeader>
              </Card>
            </motion.div>
          );
        })}

        {/* Style guide card */}
        {styleGuide && (
          <motion.div variants={staggerItem}>
            <Card className="overflow-hidden">
              {styleGuide.thumbnail && (
                <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
                  <Image
                    src={styleGuide.thumbnail}
                    alt="Style Guide"
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Palette className="size-4 text-primary" />
                  Style Guide
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                {styleGuide.fonts && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Type className="size-3" />
                    <span>
                      {styleGuide.fonts.heading} / {styleGuide.fonts.body}
                    </span>
                  </div>
                )}
                {styleGuide.colors && (
                  <div className="flex gap-1">
                    {Object.values(styleGuide.colors).map((color, i) => (
                      <div
                        key={i}
                        className="size-5 rounded-full border border-border/50"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
