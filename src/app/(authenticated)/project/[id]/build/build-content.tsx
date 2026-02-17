"use client";

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from "react";
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
  Rocket,
  GitBranch,
  Lock,
  Unlock,
  X,
  Copy,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UpgradeModal } from "@/components/features/upgrade-modal";
import { useProjectStore } from "@/stores/project-store";
import { useBuildStore } from "@/stores/build-store";
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
  const { project, features: projFeatures, userFlows, pages: projPages, designs: projDesigns, buildConfig: existingConfig, loading } =
    useProjectStore();

  // ─── Build store (persists across navigation) ──────────────────────
  const building = useBuildStore((s) => s.building);
  const buildResult = useBuildStore((s) => s.buildResult);
  const streamingFiles = useBuildStore((s) => s.streamingFiles);
  const currentStreamingPath = useBuildStore((s) => s.currentStreamingPath);
  const currentStreamingContent = useBuildStore((s) => s.currentStreamingContent);
  const selectedFile = useBuildStore((s) => s.selectedFile);
  const expandedDirs = useBuildStore((s) => s.expandedDirs);
  const verifyStatus = useBuildStore((s) => s.verifyStatus);
  const buildProjectId = useBuildStore((s) => s.projectId);
  const setSelectedFile = useBuildStore((s) => s.setSelectedFile);
  const toggleDir = useBuildStore((s) => s.toggleDir);
  const cancelBuild = useBuildStore((s) => s.cancelBuild);
  const startBuild = useBuildStore((s) => s.startBuild);
  const setBuildResult = useBuildStore((s) => s.setBuildResult);
  const setExpandedDirs = useBuildStore((s) => s.setExpandedDirs);
  const resetBuildStore = useBuildStore((s) => s.reset);

  // Reset build store when switching to a different project
  useEffect(() => {
    if (!project) return;
    if (buildProjectId && buildProjectId !== project.id) {
      resetBuildStore();
    }
  }, [project, buildProjectId, resetBuildStore]);

  // ─── Config state (local — only used for the config form) ─────────

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

  const [fileSearch, setFileSearch] = useState("");
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamingEditorRef = useRef<any>(null);

  // ─── Vercel deploy state ──────────────────────────────────────────
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [vercelToken, setVercelToken] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ url: string } | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  // ─── GitHub repo state ──────────────────────────────────────────
  const [ghDialogOpen, setGhDialogOpen] = useState(false);
  const [ghToken, setGhToken] = useState("");
  const [ghRepoName, setGhRepoName] = useState("");
  const [ghPrivate, setGhPrivate] = useState(false);
  const [ghCreating, setGhCreating] = useState(false);
  const [ghResult, setGhResult] = useState<{ url: string } | null>(null);
  const [ghError, setGhError] = useState<string | null>(null);

  // ─── Publish state ──────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishStale, setPublishStale] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [publishUpgradeOpen, setPublishUpgradeOpen] = useState(false);

  // ─── Slug / subdomain state ───────────────────────────────────────
  const [publishSlug, setPublishSlug] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const slugCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Handle upgrade signal from store ──────────────────────────────

  useEffect(() => {
    if (buildResult?.id === "__upgrade__") {
      setUpgradeOpen(true);
      setBuildResult(null);
    }
  }, [buildResult, setBuildResult]);

  // ─── Fetch existing build on mount ────────────────────────────────

  useEffect(() => {
    if (!project) return;
    // Don't fetch if we already have a result or are building
    if (buildResult || building) return;

    async function fetchBuild() {
      try {
        const res = await fetch(`/api/projects/${project!.id}/build`);
        if (!res.ok) return;
        const data = await res.json();

        if (data.output?.files?.length > 0) {
          // Tag the store with this project's ID so stale results are cleared on project switch
          useBuildStore.setState({ projectId: project!.id });
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
  }, [project, buildResult, building, setBuildResult, setExpandedDirs, setSelectedFile]);

  // ─── Project summary ─────────────────────────────────────────────

  const designedPageCount = useMemo(() => {
    const pageIds = new Set(projPages.map((p) => p.id));
    return projDesigns.filter(
      (d) => d.pageId && pageIds.has(d.pageId) && d.html !== "",
    ).length;
  }, [projPages, projDesigns]);

  const hasStyleGuide = projDesigns.some((d) => d.isStyleGuide);
  const hasPages = projPages.length > 0;
  const hasDesigns = designedPageCount > 0;

  // ─── Build handler ─────────────────────────────────────────────────

  const handleBuild = useCallback(() => {
    if (!project || building) return;
    startBuild(project.id, {
      framework,
      styling,
      includeTypeScript: showTypeScript ? includeTypeScript : false,
    });
  }, [project, building, framework, styling, includeTypeScript, showTypeScript, startBuild]);

  // ─── Download handler ─────────────────────────────────────────────

  function handleDownload() {
    if (!project) return;
    window.open(`/api/projects/${project.id}/build/download`, "_blank");
  }

  // ─── Deploy handler ──────────────────────────────────────────────

  const handleDeploy = useCallback(async () => {
    if (!project || !vercelToken.trim()) return;
    setDeploying(true);
    setDeployError(null);
    setDeployResult(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/deploy/vercel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: vercelToken.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setDeployError(data.error ?? "Deployment failed.");
        return;
      }

      // Save token for future deploys
      try {
        localStorage.setItem("vercel_token", vercelToken.trim());
      } catch {
        // localStorage may be unavailable
      }

      setDeployResult({ url: data.url });
    } catch {
      setDeployError("Something went wrong. Please try again.");
    } finally {
      setDeploying(false);
    }
  }, [project, vercelToken]);

  const openDeployDialog = useCallback(() => {
    // Pre-fill token from localStorage
    try {
      const saved = localStorage.getItem("vercel_token");
      if (saved) setVercelToken(saved);
    } catch {
      // ignore
    }
    setDeployError(null);
    setDeployResult(null);
    setDeployDialogOpen(true);
  }, []);

  // ─── GitHub handler ──────────────────────────────────────────────

  const handleGhCreate = useCallback(async () => {
    if (!project || !ghToken.trim()) return;
    setGhCreating(true);
    setGhError(null);
    setGhResult(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/deploy/github`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: ghToken.trim(),
          repoName: ghRepoName.trim() || undefined,
          isPrivate: ghPrivate,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGhError(data.error ?? "Failed to create repository.");
        return;
      }

      try {
        localStorage.setItem("github_token", ghToken.trim());
      } catch {
        // ignore
      }

      setGhResult({ url: data.url });
    } catch {
      setGhError("Something went wrong. Please try again.");
    } finally {
      setGhCreating(false);
    }
  }, [project, ghToken, ghRepoName, ghPrivate]);

  const openGhDialog = useCallback(() => {
    try {
      const saved = localStorage.getItem("github_token");
      if (saved) setGhToken(saved);
    } catch {
      // ignore
    }
    // Default repo name from project
    if (project) {
      setGhRepoName(
        project.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      );
    }
    setGhError(null);
    setGhResult(null);
    setGhDialogOpen(true);
  }, [project]);

  // ─── Fetch publish status on mount ──────────────────────────────────
  useEffect(() => {
    if (!project || !buildResult) return;

    async function fetchPublishStatus() {
      try {
        const res = await fetch(`/api/projects/${project!.id}/publish`);
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          console.error("Publish status check failed:", res.status, errBody);
          return;
        }
        const data = await res.json();
        if (data.published) {
          setPublishedUrl(data.url);
          setPublishStale(data.isStale ?? false);
        } else if (!publishSlug && project?.name) {
          // Pre-fill slug from project name when not yet published
          const defaultSlug = project.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 48);
          setPublishSlug(defaultSlug);
        }
      } catch {
        // Ignore
      }
    }

    fetchPublishStatus();
  }, [project, buildResult]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Slug change handler with debounced check ──────────────────────
  const handleSlugChange = useCallback(
    (value: string) => {
      const sanitized = value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "")
        .slice(0, 48);
      setPublishSlug(sanitized);
      setSlugAvailable(null);

      if (slugCheckTimeout.current) clearTimeout(slugCheckTimeout.current);

      if (!sanitized || sanitized.length < 3 || !project) {
        setSlugChecking(false);
        return;
      }

      setSlugChecking(true);
      slugCheckTimeout.current = setTimeout(async () => {
        try {
          const res = await fetch(
            `/api/projects/${project.id}/publish/check-slug?slug=${encodeURIComponent(sanitized)}`,
          );
          const data = await res.json();
          // Only update if the slug hasn't changed since we started checking
          setPublishSlug((current) => {
            if (current === sanitized) {
              setSlugAvailable(data.available);
              setSlugChecking(false);
            }
            return current;
          });
        } catch {
          setSlugChecking(false);
        }
      }, 500);
    },
    [project],
  );

  // ─── Publish handler ──────────────────────────────────────────────
  const handlePublish = useCallback(async () => {
    if (!project || publishing) return;
    setPublishing(true);
    setPublishError(null);

    try {
      const res = await fetch(`/api/projects/${project.id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: publishSlug || undefined }),
      });
      const data = await res.json();

      if (res.status === 403 && data.error === "upgrade_required") {
        setPublishUpgradeOpen(true);
        return;
      }

      if (!res.ok) {
        setPublishError(data.error ?? "Publishing failed.");
        return;
      }

      setPublishedUrl(data.url);
      setPublishStale(false);
      toast.success("Published! Your site is live.");
    } catch {
      setPublishError("Something went wrong. Please try again.");
    } finally {
      setPublishing(false);
    }
  }, [project, publishing, publishSlug]);

  // ─── Unpublish handler ────────────────────────────────────────────
  const handleUnpublish = useCallback(async () => {
    if (!project || unpublishing) return;
    setUnpublishing(true);

    try {
      const res = await fetch(`/api/projects/${project.id}/publish`, {
        method: "DELETE",
      });

      if (res.ok) {
        setPublishedUrl(null);
        setPublishStale(false);
        toast.success("Site unpublished.");
      }
    } catch {
      toast.error("Failed to unpublish. Please try again.");
    } finally {
      setUnpublishing(false);
    }
  }, [project, unpublishing]);

  // ─── Computed values ──────────────────────────────────────────────

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

  // ─── Preview handler ───────────────────────────────────────────────
  const openPreview = useCallback(() => {
    if (!project) return;
    window.open(`/preview/${project.id}`, "_blank");
  }, [project]);


  // ─── Streaming computed values ──────────────────────────────────

  const streamingTree = useMemo(() => {
    if (!building) return [];
    const allFiles = [...streamingFiles];
    if (currentStreamingPath) {
      allFiles.push({ path: currentStreamingPath, content: "" });
    }
    return buildFileTree(allFiles);
  }, [building, streamingFiles, currentStreamingPath]);

  const streamingEditorContent = useMemo(() => {
    if (!building || !selectedFile) return "";
    if (selectedFile === currentStreamingPath) return currentStreamingContent;
    return streamingFiles.find((f) => f.path === selectedFile)?.content ?? "";
  }, [building, selectedFile, currentStreamingPath, currentStreamingContent, streamingFiles]);

  // Auto-scroll streaming editor to bottom
  useEffect(() => {
    const editor = streamingEditorRef.current;
    if (!editor || !building || selectedFile !== currentStreamingPath) return;
    const model = editor.getModel();
    if (!model) return;
    const lastLine = model.getLineCount();
    editor.revealLine(lastLine);
  }, [streamingEditorContent, building, selectedFile, currentStreamingPath]);

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

  // ─── Render: Build in progress (streaming) ──────────────────────

  if (building) {
    return (
      <div className="flex h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Hammer className="size-4 text-primary animate-pulse" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">
                {verifyStatus ? "Verifying build..." : "Building..."}
              </h2>
              <p className="text-xs text-muted-foreground">
                {verifyStatus ? (
                  <span>{verifyStatus}</span>
                ) : (
                  <>
                    {streamingFiles.length} file{streamingFiles.length !== 1 ? "s" : ""} generated
                    {currentStreamingPath && (
                      <span className="text-primary"> — writing {currentStreamingPath.split("/").pop()}</span>
                    )}
                  </>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin text-primary" />
            <Button variant="outline" size="sm" onClick={cancelBuild}>
              <X className="size-3.5" />
              Cancel
            </Button>
          </div>
        </div>

        {/* Build disclaimer */}
        <div className="flex items-start gap-2.5 border-b border-amber-500/20 bg-amber-500/5 px-4 py-2.5 sm:px-6">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
          <p className="text-[11px] leading-relaxed text-amber-700 dark:text-amber-400">
            <span className="font-medium">Build in progress.</span>{" "}
            You can navigate to other steps and your build will continue in the background.
            Closing the browser tab or starting a new build will cancel the current one.
          </p>
        </div>

        {/* File explorer (streaming) */}
        <div className="flex min-h-0 flex-1">
          {/* File tree sidebar */}
          <div className="w-64 shrink-0 overflow-y-auto border-r border-border/60 bg-muted/30">
            <div className="px-1 py-2">
              {streamingTree.length > 0 ? (
                <FileTreeView
                  nodes={streamingTree}
                  selectedFile={selectedFile}
                  expandedDirs={expandedDirs}
                  onSelectFile={setSelectedFile}
                  onToggleDir={toggleDir}
                  depth={0}
                  streamingPath={currentStreamingPath}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                  <Loader2 className="size-5 animate-spin" />
                  <span className="text-xs">Generating files...</span>
                </div>
              )}
            </div>
          </div>

          {/* Code preview (streaming) */}
          <div className="min-w-0 flex-1">
            {selectedFile ? (
              <div className="flex h-full flex-col">
                <div className="flex items-center gap-2 border-b border-border/60 px-4 py-1.5">
                  <FileCode2 className="size-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">
                    {selectedFile}
                  </span>
                  {selectedFile === currentStreamingPath && (
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/60" />
                      <span className="relative inline-flex size-2 rounded-full bg-primary" />
                    </span>
                  )}
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
                      value={streamingEditorContent}
                      language={getLanguage(selectedFile)}
                      theme="vs-dark"
                      onMount={(editor) => {
                        streamingEditorRef.current = editor;
                      }}
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
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary/50" />
                <span className="text-sm">Waiting for files...</span>
              </div>
            )}
          </div>
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
            {publishedUrl ? (
              <>
                <div className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1.5">
                  <Globe className="size-3 text-emerald-500" />
                  <a
                    href={publishedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                  >
                    {publishedUrl.replace("https://", "")}
                  </a>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1"
                    onClick={() => {
                      navigator.clipboard.writeText(publishedUrl!);
                      toast.success("URL copied!");
                    }}
                  >
                    <Copy className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1"
                    asChild
                  >
                    <a
                      href={publishedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  </Button>
                </div>
                {publishStale && (
                  <Button
                    size="sm"
                    onClick={handlePublish}
                    disabled={publishing}
                  >
                    {publishing && (
                      <Loader2 className="size-3 animate-spin" />
                    )}
                    {publishing ? "Updating..." : "Update"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={handleUnpublish}
                  disabled={unpublishing}
                >
                  {unpublishing ? "Unpublishing..." : "Unpublish"}
                </Button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-1.5">
                  <div className="flex items-center rounded-md border border-border bg-muted/40 text-xs">
                    <input
                      type="text"
                      value={publishSlug}
                      onChange={(e) => handleSlugChange(e.target.value)}
                      placeholder="my-site"
                      className="h-7 w-32 bg-transparent px-2 text-xs outline-none placeholder:text-muted-foreground/50"
                    />
                    <span className="border-l border-border px-2 text-muted-foreground">.calypso.build</span>
                    <span className="flex w-6 items-center justify-center">
                      {slugChecking ? (
                        <Loader2 className="size-3 animate-spin text-muted-foreground" />
                      ) : slugAvailable === true ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : slugAvailable === false ? (
                        <X className="size-3 text-destructive" />
                      ) : null}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={handlePublish}
                    disabled={publishing || !publishSlug || publishSlug.length < 3 || slugAvailable === false || slugChecking}
                  >
                    {publishing ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Globe className="size-3" />
                    )}
                    {publishing ? "Publishing..." : "Publish"}
                  </Button>
                </div>
                {publishError && (
                  <p className="text-xs text-destructive">{publishError}</p>
                )}
              </>
            )}
            <div className="mx-1 h-5 w-px bg-border/60" />
            <Button variant="outline" size="sm" onClick={openPreview}>
              <Eye className="size-3.5" />
              Preview
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="size-3.5" />
              Download ZIP
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBuild}
              disabled={building}
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

        {/* Export bar */}
        <div className="flex items-center justify-end border-t border-border/60 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Export:</span>
            <Button variant="outline" size="sm" onClick={openDeployDialog}>
              <Rocket className="size-3" />
              Vercel
            </Button>
            <Button variant="outline" size="sm" onClick={openGhDialog}>
              <GitBranch className="size-3" />
              GitHub
            </Button>
          </div>
        </div>

        {/* Vercel deploy dialog */}
        <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Deploy to Vercel</DialogTitle>
              <DialogDescription>
                Enter your Vercel access token to deploy this project. You can
                create one at{" "}
                <a
                  href="https://vercel.com/account/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  vercel.com/account/tokens
                </a>
                .
              </DialogDescription>
            </DialogHeader>

            {deployResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-3">
                  <Check className="size-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Deployed successfully!
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={deployResult.url}
                    readOnly
                    className="h-8 text-xs"
                  />
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={deployResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3" />
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="Vercel access token"
                  value={vercelToken}
                  onChange={(e) => setVercelToken(e.target.value)}
                  className="h-8 text-xs"
                  disabled={deploying}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && vercelToken.trim() && !deploying) {
                      handleDeploy();
                    }
                  }}
                />
                {deployError && (
                  <p className="text-xs text-destructive">{deployError}</p>
                )}
              </div>
            )}

            <DialogFooter>
              {deployResult ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeployDialogOpen(false)}
                >
                  Close
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleDeploy}
                  disabled={deploying || !vercelToken.trim()}
                >
                  {deploying && <Loader2 className="size-3 animate-spin" />}
                  {deploying ? "Deploying..." : "Deploy"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* GitHub repo dialog */}
        <Dialog open={ghDialogOpen} onOpenChange={setGhDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Push to GitHub</DialogTitle>
              <DialogDescription>
                Create a new GitHub repository with your build files. You need a
                personal access token with the{" "}
                <code className="rounded bg-muted px-1 text-[11px]">repo</code>{" "}
                scope from{" "}
                <a
                  href="https://github.com/settings/tokens/new?scopes=repo&description=Calypso"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline hover:no-underline"
                >
                  github.com/settings/tokens
                </a>
                .
              </DialogDescription>
            </DialogHeader>

            {ghResult ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-3">
                  <Check className="size-4 text-emerald-500" />
                  <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    Repository created!
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    value={ghResult.url}
                    readOnly
                    className="h-8 text-xs"
                  />
                  <Button size="sm" variant="outline" asChild>
                    <a
                      href={ghResult.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="size-3" />
                      Open
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <Input
                  type="password"
                  placeholder="GitHub personal access token"
                  value={ghToken}
                  onChange={(e) => setGhToken(e.target.value)}
                  className="h-8 text-xs"
                  disabled={ghCreating}
                />
                <Input
                  placeholder="Repository name"
                  value={ghRepoName}
                  onChange={(e) => setGhRepoName(e.target.value)}
                  className="h-8 text-xs"
                  disabled={ghCreating}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && ghToken.trim() && !ghCreating) {
                      handleGhCreate();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setGhPrivate((p) => !p)}
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  disabled={ghCreating}
                >
                  {ghPrivate ? (
                    <Lock className="size-3" />
                  ) : (
                    <Unlock className="size-3" />
                  )}
                  {ghPrivate ? "Private repository" : "Public repository"}
                </button>
                {ghError && (
                  <p className="text-xs text-destructive">{ghError}</p>
                )}
              </div>
            )}

            <DialogFooter>
              {ghResult ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setGhDialogOpen(false)}
                >
                  Close
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleGhCreate}
                  disabled={ghCreating || !ghToken.trim()}
                >
                  {ghCreating && <Loader2 className="size-3 animate-spin" />}
                  {ghCreating ? "Creating..." : "Create Repository"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
            <Card className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <ToggleRight className="size-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">TypeScript</p>
                  <p className="text-[11px] text-muted-foreground">
                    Adds type safety with .tsx/.ts files and proper type definitions
                  </p>
                </div>
              </div>
              <Switch
                checked={includeTypeScript}
                onCheckedChange={setIncludeTypeScript}
              />
            </Card>
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
      <UpgradeModal
        open={publishUpgradeOpen}
        onOpenChange={setPublishUpgradeOpen}
        feature="Publishing requires a Pro or Founding plan. Upgrade to get a live URL for your project."
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
  streamingPath,
}: {
  nodes: TreeNode[];
  selectedFile: string | null;
  expandedDirs: Set<string>;
  onSelectFile: (path: string) => void;
  onToggleDir: (path: string) => void;
  depth: number;
  streamingPath?: string | null;
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
                  streamingPath={streamingPath}
                />
              )}
            </div>
          );
        }

        const isStreaming = streamingPath === node.path;
        const Icon = getFileIcon(node.name);
        return (
          <button
            key={node.path}
            onClick={() => onSelectFile(node.path)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded px-2 py-0.5 text-[11px] transition-colors",
              selectedFile === node.path
                ? "bg-primary/10 text-primary font-medium"
                : isStreaming
                  ? "text-primary/70"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            style={{ paddingLeft: `${depth * 12 + 20}px` }}
          >
            {isStreaming ? (
              <span className="relative flex size-3 shrink-0 items-center justify-center">
                <span className="absolute inline-flex size-2 animate-ping rounded-full bg-primary/50" />
                <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
              </span>
            ) : (
              <Icon className="size-3 shrink-0" />
            )}
            <span className="truncate">{node.name}</span>
          </button>
        );
      })}
    </>
  );
}
