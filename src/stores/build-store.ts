import { create } from "zustand";
import { toast } from "sonner";
import type { BuildFile } from "@/lib/db/schema";
import { useProjectStore } from "@/stores/project-store";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface BuildConfig {
  framework: "nextjs" | "vite_react" | "html";
  styling: "tailwind" | "css" | "scss";
  includeTypeScript: boolean;
}

interface BuildResult {
  files: BuildFile[];
  id: string;
}

interface BuildState {
  // Core state
  building: boolean;
  buildResult: BuildResult | null;
  streamingFiles: BuildFile[];
  currentStreamingPath: string | null;
  currentStreamingContent: string;

  // UI state
  selectedFile: string | null;
  expandedDirs: Set<string>;

  // Build verification
  verifyStatus: string | null;

  // The project this build belongs to
  projectId: string | null;

  // Actions
  startBuild: (projectId: string, config: BuildConfig) => void;
  cancelBuild: () => void;
  setSelectedFile: (path: string | null) => void;
  toggleDir: (path: string) => void;
  setBuildResult: (result: BuildResult | null) => void;
  setExpandedDirs: (dirs: Set<string>) => void;
  reset: () => void;
}

/* ─── Internal state (not exposed via Zustand) ───────────────────────────── */

let abortController: AbortController | null = null;

/* ─── Store ──────────────────────────────────────────────────────────────── */

const initialState = {
  building: false,
  buildResult: null as BuildResult | null,
  streamingFiles: [] as BuildFile[],
  currentStreamingPath: null as string | null,
  currentStreamingContent: "",
  selectedFile: null as string | null,
  expandedDirs: new Set<string>(),
  verifyStatus: null as string | null,
  projectId: null as string | null,
};

export const useBuildStore = create<BuildState>((set, get) => ({
  ...initialState,

  startBuild: (projectId, config) => {
    if (get().building) return;

    // Abort any previous build
    abortController?.abort();
    const abort = new AbortController();
    abortController = abort;

    set({
      building: true,
      buildResult: null,
      streamingFiles: [],
      currentStreamingPath: null,
      currentStreamingContent: "",
      selectedFile: null,
      expandedDirs: new Set(),
      verifyStatus: null,
      projectId,
    });

    // Run the SSE loop in the background — not tied to any component
    consumeStream(projectId, config, abort).catch(() => {
      // Errors handled inside consumeStream
    });
  },

  cancelBuild: () => {
    abortController?.abort();
    abortController = null;
    set({
      building: false,
      currentStreamingPath: null,
      currentStreamingContent: "",
      verifyStatus: null,
    });
  },

  setSelectedFile: (path) => set({ selectedFile: path }),

  toggleDir: (path) => {
    const { expandedDirs } = get();
    const next = new Set(expandedDirs);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    set({ expandedDirs: next });
  },

  setBuildResult: (result) => set({ buildResult: result }),

  setExpandedDirs: (dirs) => set({ expandedDirs: dirs }),

  reset: () => {
    abortController?.abort();
    abortController = null;
    set(initialState);
  },
}));

/* ─── SSE Consumer (runs outside React lifecycle) ─────────────────────── */

async function consumeStream(
  projectId: string,
  config: BuildConfig,
  abort: AbortController,
) {
  const { setState: set, getState } = useBuildStore;

  try {
    const res = await fetch(`/api/projects/${projectId}/build`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
      signal: abort.signal,
    });

    // Non-streaming error responses
    if (res.status === 403) {
      const data = await res.json();
      set({ building: false });
      if (data.error === "upgrade_required") {
        // Signal upgrade needed — component checks this via a flag
        set({ buildResult: { files: [], id: "__upgrade__" } });
        return;
      }
      toast.error(data.message ?? "Build failed.");
      return;
    }

    if (!res.ok) {
      const data = await res.json();
      toast.error(data.error ?? "Build failed. Please try again.");
      set({ building: false });
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      toast.error("Failed to read stream.");
      set({ building: false });
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";
    const allFiles: BuildFile[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (!json) continue;

        try {
          const event = JSON.parse(json);

          switch (event.type) {
            case "file_start": {
              // Auto-expand parent directories
              const expandedDirs = new Set(getState().expandedDirs);
              if (event.path) {
                const parts = event.path.split("/");
                for (let i = 1; i < parts.length; i++) {
                  expandedDirs.add(parts.slice(0, i).join("/"));
                }
              }
              set({
                currentStreamingPath: event.path,
                currentStreamingContent: "",
                selectedFile: event.path,
                expandedDirs,
              });
              break;
            }

            case "file_chunk":
              set({
                currentStreamingContent:
                  getState().currentStreamingContent + event.text,
              });
              break;

            case "file_complete": {
              const file: BuildFile = {
                path: event.path,
                content: event.content,
              };
              // Replace if file already exists (during fix iterations)
              const existingIdx = allFiles.findIndex(
                (f) => f.path === event.path,
              );
              if (existingIdx >= 0) allFiles[existingIdx] = file;
              else allFiles.push(file);

              const current = getState().streamingFiles;
              const sIdx = current.findIndex((f) => f.path === event.path);
              const updated =
                sIdx >= 0
                  ? current.map((f, i) => (i === sIdx ? file : f))
                  : [...current, file];

              set({
                streamingFiles: updated,
                currentStreamingPath: null,
                currentStreamingContent: "",
              });
              break;
            }

            case "file_truncated":
              set({
                verifyStatus: `File incomplete: ${event.path} — continuing...`,
                currentStreamingPath: null,
                currentStreamingContent: "",
              });
              break;

            case "continuation_start":
              set({
                verifyStatus: event.message ?? "Generating remaining files...",
              });
              break;

            case "continuation_complete":
              set({
                verifyStatus: `Continuation added ${event.newFiles} files`,
              });
              break;

            case "continuation_error":
            case "continuation_skipped":
              set({
                verifyStatus: event.message ?? "Saving what we have...",
              });
              break;

            case "verify":
              set({ verifyStatus: event.message ?? "Verifying build..." });
              break;

            case "verify_failed":
              set({
                verifyStatus: `Build errors found — fixing (attempt ${event.iteration}/${event.maxIterations})...`,
              });
              break;

            case "fixing":
              set({
                verifyStatus: `AI is fixing errors (attempt ${event.iteration})...`,
              });
              break;

            case "done": {
              const files = event.files ?? allFiles;
              // Update project store build config
              useProjectStore.getState().setBuildConfig({
                id: event.buildId,
                framework: config.framework,
                styling: config.styling,
                includeTypeScript: config.includeTypeScript,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
              set({
                buildResult: { files, id: event.buildId },
                streamingFiles: [],
                currentStreamingPath: null,
                currentStreamingContent: "",
                verifyStatus: null,
                building: false,
              });
              abortController = null;
              toast.success(
                `Project generated! ${files.length} files created.`,
              );
              break;
            }

            case "error":
              toast.error(event.message ?? "Build failed.");
              set({ building: false });
              abortController = null;
              break;
          }
        } catch {
          // Skip malformed JSON
        }
      }
    }

    // Stream ended without a done event — recover by fetching the build ID
    if (allFiles.length > 0 && getState().building) {
      let buildId = "";
      try {
        const res = await fetch(`/api/projects/${projectId}/build`);
        if (res.ok) {
          const data = await res.json();
          if (data.output?.id && data.output.files?.length > 0) {
            buildId = data.output.id;
          }
        }
      } catch {
        // Fall through with empty ID
      }
      set({
        buildResult: { files: allFiles, id: buildId },
        building: false,
      });
      abortController = null;
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return; // User cancelled
    }
    toast.error("Something went wrong. Please try again.");
    set({ building: false });
    abortController = null;
  }
}
