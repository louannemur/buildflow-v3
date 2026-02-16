import { create } from "zustand";
import {
  replaceElement,
  insertAfterElement,
  removeElement,
  updateElementClasses as mutateClasses,
  updateElementText as mutateText,
  updateElementAttribute as mutateAttribute,
  addClassToElement,
  removeClassFromElement,
} from "@/lib/design/code-mutator";
import { injectBfIds, stripBfIds } from "@/lib/design/inject-bf-ids";
import { isHtmlDocument } from "@/lib/design/preview-transform";

/* ─── Constants ──────────────────────────────────────────────────────────── */

const MAX_UNDO_STACK = 50;

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type EditorMode = "preview" | "design" | "code";

export type Breakpoint = "desktop" | "tablet" | "mobile";

export const BREAKPOINT_WIDTHS: Record<Breakpoint, number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 375,
};

export interface EditorElement {
  bfId: string;
  tag: string;
  classes: string;
  textContent: string;
  rect: { top: number; left: number; width: number; height: number };
  parentBfId: string | null;
  children: string[];
  attributes?: Record<string, string>;
}

export interface EditorState {
  // Source of truth (clean code without bf-ids)
  source: string;
  designId: string;
  projectId: string | null;
  pageId: string | null;

  // Selection (from iframe bridge)
  selectedBfId: string | null;
  hoveredBfId: string | null;
  selectedElement: EditorElement | null;
  hoveredElement: EditorElement | null;

  // DOM tree (from iframe bridge TREE_DATA)
  elementTree: EditorElement[];

  // Mode & viewport
  mode: EditorMode;
  breakpoint: Breakpoint;

  // Panel visibility
  showLayers: boolean;
  showProperties: boolean;
  showComponents: boolean;
  showChat: boolean;
  showHistory: boolean;

  // Undo/redo stacks
  undoStack: string[];
  redoStack: string[];

  // Style guide reference (code from another design marked as style guide)
  styleGuideCode: string | null;

  // Streaming state — suppresses normal iframe render during live streaming
  isStreamingToIframe: boolean;

  // Scroll offset from iframe (for selection overlay positioning)
  iframeScrollTop: number;
  iframeScrollLeft: number;

  // Actions
  init: (opts: {
    source: string;
    designId: string;
    projectId?: string | null;
    pageId?: string | null;
    styleGuideCode?: string | null;
  }) => void;
  updateSource: (source: string) => void;
  setMode: (mode: EditorMode) => void;
  setBreakpoint: (bp: Breakpoint) => void;

  // Selection
  setSelectedBfId: (id: string | null) => void;
  setHoveredBfId: (id: string | null) => void;
  setSelectedElement: (el: EditorElement | null) => void;
  setHoveredElement: (el: EditorElement | null) => void;
  setElementTree: (tree: EditorElement[]) => void;

  // Panels
  toggleLayers: () => void;
  toggleProperties: () => void;
  toggleComponents: () => void;
  toggleChat: () => void;
  setShowChat: (show: boolean) => void;
  toggleHistory: () => void;

  // History
  pushUndo: (code: string) => void;
  undo: () => void;
  redo: () => void;

  // Code mutation helpers (operate on annotated code, save stripped)
  updateElement: (bfId: string, newJsx: string) => void;
  deleteElement: (bfId: string) => void;
  insertAfter: (bfId: string, newJsx: string) => void;
  updateElementClasses: (bfId: string, classes: string) => void;
  addElementClass: (bfId: string, className: string) => void;
  removeElementClass: (bfId: string, className: string) => void;
  updateElementText: (bfId: string, newText: string) => void;
  updateElementAttribute: (bfId: string, attr: string, value: string) => void;

  // Other
  clearDesign: () => void;
  setStreamingToIframe: (streaming: boolean) => void;
  setStyleGuideCode: (code: string | null) => void;
  setIframeScroll: (top: number, left: number) => void;
  reset: () => void;
}

/* ─── Initial state ──────────────────────────────────────────────────────── */

const initialState = {
  source: "",
  designId: "",
  projectId: null as string | null,
  pageId: null as string | null,
  selectedBfId: null as string | null,
  hoveredBfId: null as string | null,
  selectedElement: null as EditorElement | null,
  hoveredElement: null as EditorElement | null,
  elementTree: [] as EditorElement[],
  mode: "design" as EditorMode,
  breakpoint: "desktop" as Breakpoint,
  showLayers: false,
  showProperties: false,
  showComponents: false,
  showChat: false,
  showHistory: false,
  undoStack: [] as string[],
  redoStack: [] as string[],
  styleGuideCode: null as string | null,
  isStreamingToIframe: false,
  iframeScrollTop: 0,
  iframeScrollLeft: 0,
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

/** Apply a mutation to the source code.
 * For HTML documents (which already contain bf-ids), mutate directly.
 * For legacy JSX (which stores clean code), inject bf-ids first, mutate, then strip.
 */
function mutateCode(
  source: string,
  mutation: (annotated: string) => string,
): string {
  if (isHtmlDocument(source)) {
    // HTML source already has bf-ids — mutate directly
    return mutation(source);
  }
  // Legacy JSX path: inject bf-ids, mutate, strip
  const { annotatedCode } = injectBfIds(source);
  const mutated = mutation(annotatedCode);
  return stripBfIds(mutated);
}

/* ─── Store ──────────────────────────────────────────────────────────────── */

export const useEditorStore = create<EditorState>((set, get) => ({
  ...initialState,

  init: (opts) => {
    set({
      source: opts.source,
      designId: opts.designId,
      projectId: opts.projectId ?? null,
      pageId: opts.pageId ?? null,
      styleGuideCode: opts.styleGuideCode ?? null,
      selectedBfId: null,
      hoveredBfId: null,
      selectedElement: null,
      hoveredElement: null,
      elementTree: [],
      undoStack: [],
      redoStack: [],
      mode: "design",
    });
  },

  updateSource: (source) => {
    const current = get().source;
    set({
      source,
      undoStack: [...get().undoStack.slice(-MAX_UNDO_STACK + 1), current],
      redoStack: [],
    });
  },

  setMode: (mode) => set({ mode }),
  setBreakpoint: (breakpoint) => set({ breakpoint }),

  // ─── Selection ──────────────────────────────────────────────
  setSelectedBfId: (id) => {
    const { elementTree } = get();
    const element = id
      ? elementTree.find((el) => el.bfId === id) ?? null
      : null;
    set({
      selectedBfId: id,
      selectedElement: element,
      showProperties: id ? true : get().showProperties,
    });
  },

  setHoveredBfId: (id) => {
    const { elementTree } = get();
    const element = id
      ? elementTree.find((el) => el.bfId === id) ?? null
      : null;
    set({ hoveredBfId: id, hoveredElement: element });
  },

  setSelectedElement: (el) => set({ selectedElement: el }),
  setHoveredElement: (el) => set({ hoveredElement: el }),

  setElementTree: (tree) => {
    set({ elementTree: tree });
    // Refresh selected/hovered elements with fresh data
    const { selectedBfId, hoveredBfId } = get();
    if (selectedBfId) {
      set({
        selectedElement: tree.find((el) => el.bfId === selectedBfId) ?? null,
      });
    }
    if (hoveredBfId) {
      set({
        hoveredElement: tree.find((el) => el.bfId === hoveredBfId) ?? null,
      });
    }
  },

  // ─── Panels ─────────────────────────────────────────────────
  toggleLayers: () => set((s) => ({ showLayers: !s.showLayers })),
  toggleProperties: () => set((s) => ({ showProperties: !s.showProperties })),
  toggleComponents: () => set((s) => ({ showComponents: !s.showComponents })),
  toggleChat: () => set((s) => ({ showChat: !s.showChat })),
  setShowChat: (show) => set({ showChat: show }),
  toggleHistory: () => set((s) => ({ showHistory: !s.showHistory })),

  // ─── Undo/Redo ──────────────────────────────────────────────
  pushUndo: (code) => {
    set((s) => ({
      undoStack: [...s.undoStack.slice(-MAX_UNDO_STACK + 1), code],
      redoStack: [],
    }));
  },

  undo: () => {
    const { undoStack, source } = get();
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    set({
      source: previous,
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, source],
      selectedBfId: null,
      selectedElement: null,
    });
  },

  redo: () => {
    const { redoStack, source } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      source: next,
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, source],
      selectedBfId: null,
      selectedElement: null,
    });
  },

  // ─── Code Mutations ─────────────────────────────────────────
  updateElement: (bfId, newJsx) => {
    const updated = mutateCode(get().source, (code) =>
      replaceElement(code, bfId, newJsx),
    );
    if (updated !== get().source) get().updateSource(updated);
  },

  deleteElement: (bfId) => {
    const updated = mutateCode(get().source, (code) =>
      removeElement(code, bfId),
    );
    if (updated !== get().source) {
      get().updateSource(updated);
      if (get().selectedBfId === bfId) {
        set({ selectedBfId: null, selectedElement: null });
      }
    }
  },

  insertAfter: (bfId, newJsx) => {
    const updated = mutateCode(get().source, (code) =>
      insertAfterElement(code, bfId, newJsx),
    );
    if (updated !== get().source) get().updateSource(updated);
  },

  updateElementClasses: (bfId, classes) => {
    const updated = mutateCode(get().source, (code) =>
      mutateClasses(code, bfId, classes),
    );
    if (updated !== get().source) get().updateSource(updated);
  },

  addElementClass: (bfId, className) => {
    const updated = mutateCode(get().source, (code) =>
      addClassToElement(code, bfId, className),
    );
    if (updated !== get().source) get().updateSource(updated);
  },

  removeElementClass: (bfId, className) => {
    const updated = mutateCode(get().source, (code) =>
      removeClassFromElement(code, bfId, className),
    );
    if (updated !== get().source) get().updateSource(updated);
  },

  updateElementText: (bfId, newText) => {
    const updated = mutateCode(get().source, (code) =>
      mutateText(code, bfId, newText),
    );
    if (updated !== get().source) get().updateSource(updated);
  },

  updateElementAttribute: (bfId, attr, value) => {
    const updated = mutateCode(get().source, (code) =>
      mutateAttribute(code, bfId, attr, value),
    );
    if (updated !== get().source) get().updateSource(updated);
  },

  // ─── Other ──────────────────────────────────────────────────
  clearDesign: () => {
    get().updateSource("");
    set({ selectedBfId: null, hoveredBfId: null, selectedElement: null, hoveredElement: null });
  },

  setStreamingToIframe: (streaming) => set({ isStreamingToIframe: streaming }),
  setStyleGuideCode: (code) => set({ styleGuideCode: code }),
  setIframeScroll: (top, left) =>
    set({ iframeScrollTop: top, iframeScrollLeft: left }),

  reset: () => set(initialState),
}));
