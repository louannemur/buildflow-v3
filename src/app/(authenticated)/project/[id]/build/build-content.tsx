"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Hammer,
  FileCode2,
  Globe,
  Sparkles,
  Loader2,
  Download,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  AlertTriangle,
  Check,
  ExternalLink,
  FileJson,
  FileType2,
  Settings2,
  Palette,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { UpgradeModal } from "@/components/features/upgrade-modal";
import { useProjectStore } from "@/stores/project-store";
import { cn } from "@/lib/utils";
import type { BuildFile } from "@/lib/db/schema";

/* ─── Lazy Monaco ────────────────────────────────────────────────────────── */

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

/* ─── Framework / Styling options ────────────────────────────────────────── */

const FRAMEWORKS = [
  {
    value: "nextjs" as const,
    label: "Next.js",
    desc: "Full-stack React framework with App Router, SSR, and API routes",
    recommended: true,
  },
  {
    value: "vite_react" as const,
    label: "Vite + React",
    desc: "Fast client-side React with Vite bundler and HMR",
    recommended: false,
  },
  {
    value: "html" as const,
    label: "HTML / CSS / JS",
    desc: "Static site with no framework — pure HTML, CSS, and vanilla JS",
    recommended: false,
  },
];

const STYLING_OPTIONS = [
  {
    value: "tailwind" as const,
    label: "Tailwind CSS",
    desc: "Utility-first CSS framework for rapid styling",
    recommended: true,
  },
  {
    value: "css" as const,
    label: "CSS Modules",
    desc: "Scoped CSS with module-level isolation",
    recommended: false,
  },
  {
    value: "scss" as const,
    label: "SCSS / Sass",
    desc: "CSS preprocessor with variables, nesting, and mixins",
    recommended: false,
  },
];

/* ─── Status messages during build ───────────────────────────────────────── */

const BUILD_MESSAGES = [
  "Analyzing project specification...",
  "Generating component structure...",
  "Creating page routes...",
  "Converting designs to components...",
  "Wiring up navigation...",
  "Adding styles and theming...",
  "Writing configuration files...",
  "Finalizing project...",
];

/* ─── File icon helper ───────────────────────────────────────────────────── */

function getFileIcon(name: string) {
  if (name.endsWith(".json")) return FileJson;
  if (name.endsWith(".md")) return FileText;
  if (name.endsWith(".css") || name.endsWith(".scss"))
    return FileType2;
  return FileCode2;
}

/* ─── Language from extension ────────────────────────────────────────────── */

function getLanguage(path: string): string {
  const ext = path.split(".").pop() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    css: "css",
    scss: "scss",
    html: "html",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
  };
  return map[ext] ?? "plaintext";
}

/* ─── Build file tree from flat paths ────────────────────────────────────── */

interface TreeNode {
  name: string;
  path: string;
  isDir: boolean;
  children: TreeNode[];
}

function buildFileTree(files: BuildFile[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isDir = i < parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");

      let existing = current.find((n) => n.name === name && n.isDir === isDir);

      if (!existing) {
        existing = { name, path, isDir, children: [] };
        current.push(existing);
      }

      current = existing.children;
    }
  }

  // Sort: directories first, then alphabetical
  function sortTree(nodes: TreeNode[]) {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children.length > 0) sortTree(node.children);
    }
  }

  sortTree(root);
  return root;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Build Content                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function BuildContent() {
  const router = useRouter();
  const { project, features: projFeatures, userFlows, pages: projPages, designs: projDesigns, buildConfig: existingConfig, setBuildConfig, loading } =
    useProjectStore();

  // ─── Config state ──────────────────────────────────────────────────

  const [framework, setFramework] = useState<"nextjs" | "vite_react" | "html">(
    existingConfig?.framework ?? "nextjs",
  );
  const [styling, setStyling] = useState<"tailwind" | "css" | "scss">(
    existingConfig?.styling ?? "tailwind",
  );
  const [includeTypeScript, setIncludeTypeScript] = useState(
    existingConfig?.includeTypeScript ?? true,
  );

  // Sync from store if config loads after mount
  useEffect(() => {
    if (existingConfig) {
      setFramework(existingConfig.framework);
      setStyling(existingConfig.styling);
      setIncludeTypeScript(existingConfig.includeTypeScript);
    }
  }, [existingConfig]);

  // Hide TypeScript for HTML framework
  const showTypeScript = framework !== "html";

  // ─── Build state ──────────────────────────────────────────────────

  const [building, setBuilding] = useState(false);
  const [buildMessageIdx, setBuildMessageIdx] = useState(0);
  const [buildResult, setBuildResult] = useState<{
    files: BuildFile[];
    id: string;
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [fileSearch, setFileSearch] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  // ─── Fetch existing build on mount ────────────────────────────────

  useEffect(() => {
    if (!project) return;

    async function fetchBuild() {
      try {
        const res = await fetch(`/api/projects/${project!.id}/build`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.output?.status === "complete" && data.output.files) {
          setBuildResult({
            files: data.output.files,
            id: data.output.id,
          });
          // Expand top-level dirs
          const topDirs = new Set<string>();
          for (const f of data.output.files as BuildFile[]) {
            const first = f.path.split("/")[0];
            if (f.path.includes("/")) topDirs.add(first);
          }
          setExpandedDirs(topDirs);
          // Select first file
          if (data.output.files.length > 0) {
            setSelectedFile(data.output.files[0].path);
          }
        }
      } catch {
        // Ignore
      }
    }

    fetchBuild();
  }, [project]);

  // ─── Progress messages ────────────────────────────────────────────

  useEffect(() => {
    if (!building) return;
    const interval = setInterval(() => {
      setBuildMessageIdx((i) =>
        i < BUILD_MESSAGES.length - 1 ? i + 1 : i,
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [building]);

  // ─── Project summary ─────────────────────────────────────────────

  const designedPageCount = useMemo(() => {
    const pageIds = new Set(projPages.map((p) => p.id));
    return projDesigns.filter(
      (d) => d.pageId && pageIds.has(d.pageId) && d.html.length > 0,
    ).length;
  }, [projPages, projDesigns]);

  const hasStyleGuide = projDesigns.some((d) => d.isStyleGuide);
  const hasPages = projPages.length > 0;
  const hasDesigns = designedPageCount > 0;

  // ─── Build handler ────────────────────────────────────────────────

  const handleBuild = useCallback(async () => {
    if (!project || building) return;

    setBuilding(true);
    setBuildMessageIdx(0);
    setBuildResult(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/build`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          framework,
          styling,
          includeTypeScript: showTypeScript ? includeTypeScript : false,
        }),
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.error === "upgrade_required") {
          setUpgradeOpen(true);
          return;
        }
      }

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Build failed. Please try again.");
        return;
      }

      const data = await res.json();

      // Update store config
      setBuildConfig({
        id: data.id,
        framework,
        styling,
        includeTypeScript: showTypeScript ? includeTypeScript : false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setBuildResult({ files: data.files, id: data.id });

      // Expand top-level dirs
      const topDirs = new Set<string>();
      for (const f of data.files as BuildFile[]) {
        const first = f.path.split("/")[0];
        if (f.path.includes("/")) topDirs.add(first);
      }
      setExpandedDirs(topDirs);

      // Select first file
      if (data.files.length > 0) {
        setSelectedFile(data.files[0].path);
      }

      toast.success(
        `Project generated! ${data.files.length} files created.`,
      );
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setBuilding(false);
    }
  }, [
    project,
    building,
    framework,
    styling,
    includeTypeScript,
    showTypeScript,
    setBuildConfig,
  ]);

  // ─── Download handler ─────────────────────────────────────────────

  function handleDownload() {
    if (!project) return;
    window.open(`/api/projects/${project.id}/build/download`, "_blank");
  }

  // ─── File tree helpers ────────────────────────────────────────────

  function toggleDir(path: string) {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const selectedContent = useMemo(() => {
    if (!buildResult || !selectedFile) return "";
    return (
      buildResult.files.find((f) => f.path === selectedFile)?.content ?? ""
    );
  }, [buildResult, selectedFile]);

  const fileTree = useMemo(
    () => (buildResult ? buildFileTree(buildResult.files) : []),
    [buildResult],
  );

  const filteredFiles = useMemo(() => {
    if (!fileSearch.trim() || !buildResult) return null;
    return buildResult.files.filter((f) =>
      f.path.toLowerCase().includes(fileSearch.toLowerCase()),
    );
  }, [fileSearch, buildResult]);

  // ─── Loading state ────────────────────────────────────────────────

  if (loading || !project) {
    return (
      <div className="p-6 sm:p-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // ─── Render: Build in progress ────────────────────────────────────

  if (building) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8">
        <div className="relative">
          <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10">
            <Hammer className="size-10 text-primary animate-pulse" />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Building your project...</h2>
          <p className="mt-2 text-sm text-muted-foreground transition-all duration-500">
            {BUILD_MESSAGES[buildMessageIdx]}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-xs text-muted-foreground">
            This may take a minute
          </span>
        </div>
      </div>
    );
  }

  // ─── Render: Build output ─────────────────────────────────────────

  if (buildResult) {
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10">
              <Check className="size-4 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Build Complete</h2>
              <p className="text-xs text-muted-foreground">
                {buildResult.files.length} files generated
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="size-3.5" />
              Download ZIP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBuildResult(null)}
            >
              <RotateCcw className="size-3.5" />
              Rebuild
            </Button>
          </div>
        </div>

        {/* File explorer */}
        <div className="flex min-h-0 flex-1">
          {/* File tree sidebar */}
          <div className="w-64 shrink-0 overflow-y-auto border-r border-border/60 bg-muted/30">
            <div className="p-2">
              <Input
                value={fileSearch}
                onChange={(e) => setFileSearch(e.target.value)}
                placeholder="Search files..."
                className="h-7 text-xs"
              />
            </div>

            <div className="px-1 pb-2">
              {filteredFiles ? (
                // Flat search results
                filteredFiles.map((f) => (
                  <button
                    key={f.path}
                    onClick={() => {
                      setSelectedFile(f.path);
                      setFileSearch("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-1.5 rounded px-2 py-1 text-[11px] transition-colors",
                      selectedFile === f.path
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    <FileCode2 className="size-3 shrink-0" />
                    <span className="truncate">{f.path}</span>
                  </button>
                ))
              ) : (
                // Tree view
                <FileTreeView
                  nodes={fileTree}
                  selectedFile={selectedFile}
                  expandedDirs={expandedDirs}
                  onSelectFile={setSelectedFile}
                  onToggleDir={toggleDir}
                  depth={0}
                />
              )}
            </div>
          </div>

          {/* Code preview */}
          <div className="min-w-0 flex-1">
            {selectedFile ? (
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b border-border/60 px-4 py-1.5">
                  <FileCode2 className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedFile}
                  </span>
                </div>
                <div className="min-h-0 flex-1">
                  <Suspense
                    fallback={
                      <div className="flex h-full items-center justify-center">
                        <Loader2 className="size-5 animate-spin text-muted-foreground" />
                      </div>
                    }
                  >
                    <MonacoEditor
                      value={selectedContent}
                      language={getLanguage(selectedFile)}
                      theme="vs-dark"
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        padding: { top: 12 },
                      }}
                    />
                  </Suspense>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Select a file to preview
              </div>
            )}
          </div>
        </div>

        {/* Deployment links */}
        <div className="flex items-center gap-3 border-t border-border/60 px-4 py-3 sm:px-6">
          <span className="text-xs text-muted-foreground">Deploy:</span>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://vercel.com/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-3" />
              Deploy to Vercel
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://github.com/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="size-3" />
              Create GitHub Repo
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render: Config + Summary ─────────────────────────────────────

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Build</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your tech stack and generate a production-ready codebase.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Left: Configuration */}
        <div className="space-y-8">
          {/* Framework */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Settings2 className="size-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Framework</Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {FRAMEWORKS.map((fw) => (
                <Card
                  key={fw.value}
                  className={cn(
                    "relative cursor-pointer p-4 transition-all hover:shadow-sm",
                    framework === fw.value
                      ? "border-primary ring-1 ring-primary/20"
                      : "hover:border-primary/50",
                  )}
                  onClick={() => setFramework(fw.value)}
                >
                  {fw.recommended && (
                    <Badge className="absolute -top-2 right-3 text-[9px]">
                      Recommended
                    </Badge>
                  )}
                  <div className="flex items-center gap-2">
                    <Globe className="size-4 text-primary" />
                    <span className="text-sm font-medium">{fw.label}</span>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {fw.desc}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          {/* Styling */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Styling</Label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {STYLING_OPTIONS.map((opt) => (
                <Card
                  key={opt.value}
                  className={cn(
                    "relative cursor-pointer p-4 transition-all hover:shadow-sm",
                    styling === opt.value
                      ? "border-primary ring-1 ring-primary/20"
                      : "hover:border-primary/50",
                  )}
                  onClick={() => setStyling(opt.value)}
                >
                  {opt.recommended && (
                    <Badge className="absolute -top-2 right-3 text-[9px]">
                      Recommended
                    </Badge>
                  )}
                  <span className="text-sm font-medium">{opt.label}</span>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
                    {opt.desc}
                  </p>
                </Card>
              ))}
            </div>
          </div>

          {/* TypeScript */}
          {showTypeScript && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <ToggleRight className="size-4 text-muted-foreground" />
                <Label className="text-sm font-medium">TypeScript</Label>
              </div>
              <Card className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">Include TypeScript</p>
                  <p className="text-[11px] text-muted-foreground">
                    Adds type safety with .tsx/.ts files and proper type
                    definitions
                  </p>
                </div>
                <Switch
                  checked={includeTypeScript}
                  onCheckedChange={setIncludeTypeScript}
                />
              </Card>
            </div>
          )}
        </div>

        {/* Right: Summary + Build button */}
        <div className="space-y-6">
          {/* Project summary */}
          <Card className="p-4">
            <h3 className="text-sm font-semibold">Project Summary</h3>
            <div className="mt-3 space-y-2.5">
              <SummaryRow
                label="Features"
                value={`${projFeatures.length} defined`}
                ok={projFeatures.length > 0}
              />
              <SummaryRow
                label="User flows"
                value={`${userFlows.length} mapped`}
                ok={userFlows.length > 0}
              />
              <SummaryRow
                label="Pages"
                value={`${projPages.length} planned`}
                ok={hasPages}
              />
              <SummaryRow
                label="Designs"
                value={`${designedPageCount}/${projPages.length} pages designed`}
                ok={hasDesigns}
                warn={
                  hasDesigns && designedPageCount < projPages.length
                }
              />
              <SummaryRow
                label="Style guide"
                value={hasStyleGuide ? "Set" : "Not set"}
                ok={hasStyleGuide}
                optional
              />
            </div>
          </Card>

          {/* Warnings */}
          {(!hasPages || !hasDesigns) && (
            <Card className="border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex gap-2">
                <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                <div className="space-y-1">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                    Missing content
                  </p>
                  {!hasPages && (
                    <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80">
                      No pages defined.{" "}
                      <button
                        onClick={() =>
                          router.push(
                            `/project/${project.id}/pages`,
                          )
                        }
                        className="underline hover:no-underline"
                      >
                        Add pages
                      </button>
                    </p>
                  )}
                  {hasPages && !hasDesigns && (
                    <p className="text-[11px] text-amber-600/80 dark:text-amber-500/80">
                      No pages have designs yet.{" "}
                      <button
                        onClick={() =>
                          router.push(
                            `/project/${project.id}/designs`,
                          )
                        }
                        className="underline hover:no-underline"
                      >
                        Create designs
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Build button */}
          <Button
            size="lg"
            className="w-full gap-2"
            onClick={handleBuild}
            disabled={building}
          >
            <Sparkles className="size-4" />
            Build Project
          </Button>

          <p className="text-center text-[10px] text-muted-foreground">
            Requires Pro or Founding plan
          </p>
        </div>
      </div>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature="Building projects requires a Pro or Founding plan. Upgrade to generate your full codebase."
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Summary Row                                                              */
/* ═══════════════════════════════════════════════════════════════════════════ */

function SummaryRow({
  label,
  value,
  ok,
  warn,
  optional,
}: {
  label: string;
  value: string;
  ok: boolean;
  warn?: boolean;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "font-medium",
          warn
            ? "text-amber-500"
            : ok
              ? "text-foreground"
              : optional
                ? "text-muted-foreground"
                : "text-destructive",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  File Tree View (recursive)                                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

function FileTreeView({
  nodes,
  selectedFile,
  expandedDirs,
  onSelectFile,
  onToggleDir,
  depth,
}: {
  nodes: TreeNode[];
  selectedFile: string | null;
  expandedDirs: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleDir: (path: string) => void;
  depth: number;
}) {
  return (
    <>
      {nodes.map((node) => {
        if (node.isDir) {
          const isOpen = expandedDirs.has(node.path);
          const DirIcon = isOpen ? FolderOpen : Folder;
          const Arrow = isOpen ? ChevronDown : ChevronRight;

          return (
            <div key={node.path}>
              <button
                onClick={() => onToggleDir(node.path)}
                className="flex w-full items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
              >
                <Arrow className="size-3 shrink-0" />
                <DirIcon className="size-3 shrink-0 text-amber-500/70" />
                <span className="truncate">{node.name}</span>
              </button>
              {isOpen && (
                <FileTreeView
                  nodes={node.children}
                  selectedFile={selectedFile}
                  expandedDirs={expandedDirs}
                  onSelectFile={onSelectFile}
                  onToggleDir={onToggleDir}
                  depth={depth + 1}
                />
              )}
            </div>
          );
        }

        const Icon = getFileIcon(node.name);
        return (
          <button
            key={node.path}
            onClick={() => onSelectFile(node.path)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-[11px] transition-colors",
              selectedFile === node.path
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            style={{ paddingLeft: `${depth * 12 + 20}px` }}
          >
            <Icon className="size-3 shrink-0" />
            <span className="truncate">{node.name}</span>
          </button>
        );
      })}
    </>
  );
}
