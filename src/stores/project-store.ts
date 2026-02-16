import { create } from "zustand";
import { toast } from "sonner";
import type {
  FlowStep,
  PageContent,
  DesignFonts,
  DesignColors,
} from "@/lib/db/schema";

/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface ProjectFeature {
  id: string;
  title: string;
  description: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectUserFlow {
  id: string;
  title: string;
  steps: FlowStep[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectPage {
  id: string;
  title: string;
  description: string | null;
  contents: PageContent[] | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectDesign {
  id: string;
  name: string;
  html: string;
  thumbnail: string | null;
  fonts: DesignFonts | null;
  colors: DesignColors | null;
  isStandalone: boolean;
  isStyleGuide: boolean;
  pageId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBuildConfig {
  id: string;
  framework: "nextjs" | "vite_react" | "html";
  styling: "tailwind" | "css" | "scss";
  includeTypeScript: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStep =
  | "features"
  | "flows"
  | "pages"
  | "designs"
  | "build";

export interface Project {
  id: string;
  name: string;
  description: string | null;
  thumbnail: string | null;
  currentStep: ProjectStep;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/* ─── Store ──────────────────────────────────────────────────────────────── */

interface ProjectState {
  // Data
  project: Project | null;
  features: ProjectFeature[];
  userFlows: ProjectUserFlow[];
  pages: ProjectPage[];
  designs: ProjectDesign[];
  buildConfig: ProjectBuildConfig | null;
  loading: boolean;

  // Project actions
  setProject: (project: Project) => void;
  updateProject: (partial: Partial<Project>) => void;

  // Feature actions
  setFeatures: (features: ProjectFeature[]) => void;
  addFeature: (feature: ProjectFeature) => void;
  updateFeature: (id: string, partial: Partial<ProjectFeature>) => void;
  removeFeature: (id: string) => void;

  // User flow actions
  setUserFlows: (flows: ProjectUserFlow[]) => void;
  addUserFlow: (flow: ProjectUserFlow) => void;
  updateUserFlow: (id: string, partial: Partial<ProjectUserFlow>) => void;
  removeUserFlow: (id: string) => void;

  // Page actions
  setPages: (pages: ProjectPage[]) => void;
  addPage: (page: ProjectPage) => void;
  updatePage: (id: string, partial: Partial<ProjectPage>) => void;
  removePage: (id: string) => void;

  // Design actions
  setDesigns: (designs: ProjectDesign[]) => void;
  addDesign: (design: ProjectDesign) => void;
  updateDesign: (id: string, partial: Partial<ProjectDesign>) => void;
  removeDesign: (id: string) => void;

  // Build config actions
  setBuildConfig: (config: ProjectBuildConfig | null) => void;

  // Design generation (survives navigation)
  designGenProgress: number;
  designGenTotal: number;
  designGenerating: boolean;
  designGenCurrentPageName: string | null;
  designGenProjectId: string | null;
  generateAllDesigns: () => Promise<void>;
  regenerateAllDesigns: (exceptPageId: string) => Promise<void>;
  resumeDesignGeneration: () => void;

  // Loading
  setLoading: (loading: boolean) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  project: null,
  features: [],
  userFlows: [],
  pages: [],
  designs: [],
  buildConfig: null,
  loading: true,
  designGenProgress: 0,
  designGenTotal: 0,
  designGenerating: false,
  designGenCurrentPageName: null as string | null,
  designGenProjectId: null as string | null,
};

/* ─── Design batch runner ─────────────────────────────────────────────── */

/** Fire-and-forget Claude review for a design (updates DB in background). */
function reviewDesignInBackground(projectId: string, designId: string) {
  fetch(`/api/projects/${projectId}/designs/review`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ designId }),
  }).catch(() => {
    // Non-critical — design still has the Gemini output
  });
}

async function runDesignBatch(
  projectId: string,
  pages: ProjectPage[],
  set: (partial: Partial<ProjectState>) => void,
  options?: { forceRegenerate?: boolean },
) {
  set({
    designGenerating: true,
    designGenProgress: 0,
    designGenTotal: pages.length,
    designGenCurrentPageName: null,
    designGenProjectId: projectId,
  });

  const batchKey = `design-batch-${projectId}`;
  let completed = 0;

  for (const page of pages) {
    const current = useProjectStore.getState();
    // Stop only if explicitly cancelled (not by navigation reset)
    if (!current.designGenerating) break;

    set({ designGenCurrentPageName: page.title });

    try {
      // Generate with Gemini only (skip Claude review for speed)
      const res = await fetch(
        `/api/projects/${projectId}/designs/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pageId: page.id,
            skipReview: true,
            ...(options?.forceRegenerate && { forceRegenerate: true }),
          }),
        },
      );

      if (res.ok) {
        const design = await res.json();
        // Show design immediately in store
        const s = useProjectStore.getState();
        if (s.project?.id === projectId) {
          const exists = s.designs.some((d) => d.id === design.id);
          if (exists) {
            s.updateDesign(design.id, design);
          } else {
            s.addDesign(design);
          }
        }
        // Fire off Claude review in background while moving to next page
        reviewDesignInBackground(projectId, design.id);
      }
    } catch {
      // Continue with remaining pages
    }

    completed++;
    set({ designGenProgress: completed });

    // Update localStorage — remove completed page
    try {
      const stored = localStorage.getItem(batchKey);
      if (stored) {
        const remaining = (JSON.parse(stored) as string[]).filter(
          (id) => id !== page.id,
        );
        if (remaining.length > 0) {
          localStorage.setItem(batchKey, JSON.stringify(remaining));
        } else {
          localStorage.removeItem(batchKey);
        }
      }
    } catch {
      // Non-critical
    }
  }

  set({
    designGenerating: false,
    designGenCurrentPageName: null,
    designGenProjectId: null,
  });
  localStorage.removeItem(batchKey);

  if (completed > 0) {
    toast.success(
      `Generated designs for ${completed} page${completed !== 1 ? "s" : ""}.`,
    );
  }
}

export const useProjectStore = create<ProjectState>((set) => ({
  ...initialState,

  // Project
  setProject: (project) => set({ project }),
  updateProject: (partial) =>
    set((state) => ({
      project: state.project ? { ...state.project, ...partial } : null,
    })),

  // Features
  setFeatures: (features) => set({ features }),
  addFeature: (feature) =>
    set((state) => ({ features: [...state.features, feature] })),
  updateFeature: (id, partial) =>
    set((state) => ({
      features: state.features.map((f) =>
        f.id === id ? { ...f, ...partial } : f,
      ),
    })),
  removeFeature: (id) =>
    set((state) => ({
      features: state.features.filter((f) => f.id !== id),
    })),

  // User flows
  setUserFlows: (userFlows) => set({ userFlows }),
  addUserFlow: (flow) =>
    set((state) => ({ userFlows: [...state.userFlows, flow] })),
  updateUserFlow: (id, partial) =>
    set((state) => ({
      userFlows: state.userFlows.map((f) =>
        f.id === id ? { ...f, ...partial } : f,
      ),
    })),
  removeUserFlow: (id) =>
    set((state) => ({
      userFlows: state.userFlows.filter((f) => f.id !== id),
    })),

  // Pages
  setPages: (pages) => set({ pages }),
  addPage: (page) => set((state) => ({ pages: [...state.pages, page] })),
  updatePage: (id, partial) =>
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === id ? { ...p, ...partial } : p,
      ),
    })),
  removePage: (id) =>
    set((state) => ({
      pages: state.pages.filter((p) => p.id !== id),
    })),

  // Designs
  setDesigns: (designs) => set({ designs }),
  addDesign: (design) =>
    set((state) => ({ designs: [...state.designs, design] })),
  updateDesign: (id, partial) =>
    set((state) => ({
      designs: state.designs.map((d) =>
        d.id === id ? { ...d, ...partial } : d,
      ),
    })),
  removeDesign: (id) =>
    set((state) => ({
      designs: state.designs.filter((d) => d.id !== id),
    })),

  // Build config
  setBuildConfig: (buildConfig) => set({ buildConfig }),

  // Design generation
  designGenProgress: 0,
  designGenTotal: 0,
  designGenerating: false,
  designGenCurrentPageName: null,
  designGenProjectId: null,

  generateAllDesigns: async () => {
    const state = useProjectStore.getState();
    if (!state.project || state.designGenerating) return;

    const pageDesignIds = new Set(
      state.designs
        .filter((d) => d.pageId && d.html && d.html.length > 0)
        .map((d) => d.pageId),
    );
    const toGenerate = state.pages.filter((p) => !pageDesignIds.has(p.id));

    if (toGenerate.length === 0) return;

    // Persist batch to localStorage for resumption
    const batchKey = `design-batch-${state.project.id}`;
    localStorage.setItem(batchKey, JSON.stringify(toGenerate.map((p) => p.id)));

    runDesignBatch(state.project.id, toGenerate, set);
  },

  regenerateAllDesigns: async (exceptPageId: string) => {
    const state = useProjectStore.getState();
    if (!state.project || state.designGenerating) return;

    // Get all pages that have existing designs, except the one we're skipping
    const designedPageIds = new Set(
      state.designs
        .filter((d) => d.pageId && d.html && d.html.length > 0 && d.pageId !== exceptPageId)
        .map((d) => d.pageId),
    );
    const toRegenerate = state.pages.filter((p) => designedPageIds.has(p.id));

    if (toRegenerate.length === 0) return;

    runDesignBatch(state.project.id, toRegenerate, set, { forceRegenerate: true });
  },

  resumeDesignGeneration: () => {
    const state = useProjectStore.getState();
    if (!state.project || state.designGenerating) return;

    const batchKey = `design-batch-${state.project.id}`;
    const stored = localStorage.getItem(batchKey);
    if (!stored) return;

    let pageIds: string[];
    try {
      pageIds = JSON.parse(stored);
    } catch {
      localStorage.removeItem(batchKey);
      return;
    }

    // Filter to pages that still need generation
    const designedPageIds = new Set(
      state.designs
        .filter((d) => d.pageId && d.html && d.html.length > 0)
        .map((d) => d.pageId),
    );
    const remainingIds = new Set(pageIds.filter((id) => !designedPageIds.has(id)));
    const remaining = state.pages.filter((p) => remainingIds.has(p.id));

    if (remaining.length === 0) {
      localStorage.removeItem(batchKey);
      return;
    }

    runDesignBatch(state.project.id, remaining, set);
  },

  // Loading
  setLoading: (loading) => set({ loading }),

  // Reset — preserve generation state so background batch continues
  reset: () => {
    const {
      designGenerating,
      designGenProgress,
      designGenTotal,
      designGenCurrentPageName,
      designGenProjectId,
    } = useProjectStore.getState();

    set({
      ...initialState,
      ...(designGenerating && {
        designGenerating,
        designGenProgress,
        designGenTotal,
        designGenCurrentPageName,
        designGenProjectId,
      }),
    });
  },
}));
