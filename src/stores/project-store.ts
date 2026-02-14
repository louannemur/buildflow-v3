import { create } from "zustand";
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
};

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

  // Loading
  setLoading: (loading) => set({ loading }),

  // Reset
  reset: () => set(initialState),
}));
