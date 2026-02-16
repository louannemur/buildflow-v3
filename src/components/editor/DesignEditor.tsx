"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { useEditorStore } from "@/lib/editor/store";
import { Canvas } from "./canvas";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { CodePanel } from "./CodePanel";
import { Toolbar } from "./Toolbar";
import { StylePickerModal } from "./StylePickerModal";
import type { GenerateConfig } from "./StylePickerModal";
import { RegenerationModal } from "./RegenerationModal";
import { StreamingIndicator } from "./StreamingOverlay";
import { VersionHistory } from "./VersionHistory";
import { EditorChatPanel } from "./EditorChatPanel";
import { useAIGenerate } from "@/hooks/useAIGenerate";
import { useChatHistoryStore } from "@/stores/chat-history-store";
import { UpgradeModal } from "@/components/features/upgrade-modal";
import { useProjectStore } from "@/stores/project-store";
import { extractHtmlFromStream } from "@/lib/ai/extract-code";


/* ─── Types ──────────────────────────────────────────────────────────────── */

export interface ProjectContext {
  name: string;
  description?: string | null;
  features?: { title: string; description: string }[];
  flows?: { title: string; steps: { title: string; description: string }[] }[];
  pages?: { title: string; description?: string | null }[];
}

/* ─── Props ──────────────────────────────────────────────────────────────── */

interface DesignEditorProps {
  designId: string;
  projectId?: string | null;
  pageId?: string | null;
  designName: string;
  isStyleGuide: boolean;
  initialCode?: string;
  styleGuideCode?: string | null;
  projectContext?: ProjectContext | null;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Design Editor                                                            */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function DesignEditor({
  designId,
  projectId,
  pageId,
  designName,
  isStyleGuide,
  initialCode = "",
  styleGuideCode = null,
  projectContext = null,
}: DesignEditorProps) {
  const init = useEditorStore((s) => s.init);
  const reset = useEditorStore((s) => s.reset);
  const mode = useEditorStore((s) => s.mode);
  const source = useEditorStore((s) => s.source);
  const updateSource = useEditorStore((s) => s.updateSource);
  const selectedBfId = useEditorStore((s) => s.selectedBfId);
  const setSelectedBfId = useEditorStore((s) => s.setSelectedBfId);
  const showLayers = useEditorStore((s) => s.showLayers);
  const showProperties = useEditorStore((s) => s.showProperties);
  const showChat = useEditorStore((s) => s.showChat);
  const showHistory = useEditorStore((s) => s.showHistory);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setStreamingToIframe = useEditorStore((s) => s.setStreamingToIframe);
  const setBreakpoint = useEditorStore((s) => s.setBreakpoint);


  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const regenerateAllDesigns = useProjectStore((s) => s.regenerateAllDesigns);

  // Refs for live iframe streaming
  const streamHtmlStartedRef = useRef(false);
  const streamPrevHtmlLenRef = useRef(0);

  // AI generation
  const {
    isGenerating,
    editDesignStream,
    modifyElementStream,
    addSectionAfterStream,
    showUpgradeModal,
    setShowUpgradeModal,
    streamPhase,
    cancelStream,
    setOnStreamChunk,
  } = useAIGenerate();

  const { addMessage, getHistory } = useChatHistoryStore();

  // ─── Initialize store on mount ────────────────────────────────────

  useEffect(() => {
    init({
      source: initialCode,
      designId,
      projectId,
      pageId,
      styleGuideCode,
    });

    // Auto-set mobile breakpoint for mobile app screens
    const name = designName.toLowerCase();
    if (/\b(mobile.?app|app.?screen|phone.?screen|ios.?screen|android.?screen|mobile.?screen|mobile.?view|app.?view)\b/.test(name) || (name.includes("mobile") && name.includes("app"))) {
      setBreakpoint("mobile");
    }

    return () => {
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId]);

  // Auto-open style picker when design has no code
  useEffect(() => {
    if (!initialCode.trim()) {
      setStylePickerOpen(true);
    }
  }, [initialCode]);

  // ─── Live iframe streaming ──────────────────────────────────────────

  useEffect(() => {
    setOnStreamChunk((chunk: string, accumulated: string) => {
      const iframe = iframeRef.current;
      if (!iframe) return;

      const { htmlStarted, htmlContent } = extractHtmlFromStream(accumulated);

      if (!htmlStarted) return;

      if (!streamHtmlStartedRef.current) {
        // First time HTML detected — open the iframe document and write initial content
        streamHtmlStartedRef.current = true;
        streamPrevHtmlLenRef.current = 0;
        setStreamingToIframe(true);

        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (doc) {
            doc.open();
            doc.write(htmlContent);
            streamPrevHtmlLenRef.current = htmlContent.length;
          }
        } catch (e) {
          console.error("Streaming write error:", e);
        }
      } else {
        // Subsequent chunk — write only the new portion
        const newContent = htmlContent.slice(streamPrevHtmlLenRef.current);
        streamPrevHtmlLenRef.current = htmlContent.length;

        if (newContent) {
          try {
            const doc = iframe.contentDocument || iframe.contentWindow?.document;
            if (doc) {
              doc.write(newContent);
            }
          } catch (e) {
            console.error("Streaming write error:", e);
          }
        }
      }
    });

    return () => setOnStreamChunk(null);
  }, [setOnStreamChunk, setStreamingToIframe]);

  // Reset streaming refs when generation finishes
  useEffect(() => {
    if (streamPhase === "idle" && streamHtmlStartedRef.current) {
      streamHtmlStartedRef.current = false;
      streamPrevHtmlLenRef.current = 0;
      // setStreamingToIframe(false) is called by the handlers after updateSource
    }
  }, [streamPhase]);

  // ─── AI Handlers ──────────────────────────────────────────────────

  const buildGeneratePrompt = useCallback(
    (config: GenerateConfig | "surprise"): string => {
      const parts: string[] = [
        "Generate a complete, beautiful, Awwwards-quality design.",
      ];

      if (config === "surprise") {
        parts.push(
          "Pick a creative, visually striking style. Surprise the user with something unique and polished.",
        );
      } else {
        // Style
        const styleLabels: Record<string, string> = {
          modern: "Modern / Minimal",
          bold: "Bold / Striking",
          soft: "Soft / Organic",
          corporate: "Corporate / Professional",
          playful: "Playful / Creative",
        };
        parts.push(`Style: ${styleLabels[config.style] ?? config.style}.`);

        // Colors
        if (config.colorScheme === "custom") {
          parts.push(
            `Use these exact colors — primary: ${config.customColors.primary}, secondary: ${config.customColors.secondary}, accent: ${config.customColors.accent}.`,
          );
        } else {
          const schemeLabels: Record<string, string> = {
            vibrant: "Vibrant, saturated colors",
            muted: "Muted, soft tones",
            dark: "Dark mode with deep backgrounds",
            pastel: "Light pastel palette",
            monochrome: "Monochrome grayscale palette",
          };
          parts.push(`Color scheme: ${schemeLabels[config.colorScheme] ?? config.colorScheme}.`);
        }

        // Animations
        if (config.animations) {
          const animLabels: Record<string, string> = {
            fade: "subtle fade-in animations on scroll",
            slide: "slide-up entrance animations on scroll",
            scale: "scale-in animations on scroll",
            parallax: "parallax scrolling effects",
          };
          parts.push(`Include ${animLabels[config.animationType] ?? "animations"}.`);
        } else {
          parts.push("No animations — keep everything static.");
        }

        // Additional instructions
        if (config.instructions.trim()) {
          parts.push(`Additional requirements: ${config.instructions.trim()}`);
        }
      }

      // Project context
      if (projectContext?.name) {
        parts.push(`This is for "${projectContext.name}".`);
      }
      if (projectContext?.description) {
        parts.push(projectContext.description);
      }

      return parts.join(" ");
    },
    [projectContext],
  );

  const handleGenerateDesign = useCallback(
    async (config: GenerateConfig | "surprise") => {
      setStylePickerOpen(false);
      setSelectedBfId(null);

      const prompt = buildGeneratePrompt(config);
      const label =
        config === "surprise"
          ? "Surprise me"
          : `Generate ${config.style} design (${config.colorScheme} colors)`;

      const result = await editDesignStream(
        prompt,
        source,
        getHistory(designId),
      );

      if (result) {
        updateSource(result);
        setStreamingToIframe(false);
        addMessage(designId, {
          role: "user",
          content: label,
          editType: "full-page",
        });
        addMessage(designId, {
          role: "assistant",
          content: "Design generated! You can now refine it with further edits.",
          editType: "full-page",
        });

        // Save to DB
        await fetch(`/api/designs/${designId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: result }),
        });
      } else {
        setStreamingToIframe(false);
      }
    },
    [source, designId, buildGeneratePrompt, editDesignStream, updateSource, addMessage, getHistory, setStreamingToIframe, setSelectedBfId],
  );

  const handleEditDesign = useCallback(
    async (prompt: string) => {
      setSelectedBfId(null);
      const result = await editDesignStream(
        prompt,
        source,
        getHistory(designId),
      );

      if (result) {
        updateSource(result);
        setStreamingToIframe(false);
        addMessage(designId, {
          role: "assistant",
          content: `Done! I've updated the design based on your request: "${prompt}"`,
          editType: "full-page",
        });

        await fetch(`/api/designs/${designId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: result }),
        });
      } else {
        setStreamingToIframe(false);
        addMessage(designId, {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        });
      }
    },
    [source, designId, editDesignStream, updateSource, addMessage, getHistory, setStreamingToIframe, setSelectedBfId],
  );

  const handleElementEdit = useCallback(
    async (bfId: string, prompt: string) => {
      const element = useEditorStore.getState().elementTree.find((el) => el.bfId === bfId);

      const result = await modifyElementStream(
        bfId,
        prompt,
        element
          ? `<${element.tag} class="${element.classes}">${element.textContent}</${element.tag}>`
          : "",
        source,
      );

      if (result) {
        // Use updateElement to merge the modified element into the full page source
        // (the AI returns only the modified element, not the full document)
        useEditorStore.getState().updateElement(bfId, result);
        setStreamingToIframe(false);
        addMessage(designId, {
          role: "assistant",
          content: `Updated the <${element?.tag ?? "element"}> — applied: "${prompt}"`,
          editType: "element",
        });

        const newSource = useEditorStore.getState().source;
        await fetch(`/api/designs/${designId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: newSource }),
        });
      } else {
        setStreamingToIframe(false);
        addMessage(designId, {
          role: "assistant",
          content: "Something went wrong. Please try again.",
        });
      }
    },
    [source, designId, modifyElementStream, addMessage, setStreamingToIframe],
  );

  const handleAddSection = useCallback(
    async (afterBfId: string, prompt: string) => {
      const result = await addSectionAfterStream(afterBfId, prompt, source);

      if (result) {
        // Use insertAfter to merge the new section into the full page source
        // (the AI returns only the new section, not the full document)
        useEditorStore.getState().insertAfter(afterBfId, result);
        setStreamingToIframe(false);
        addMessage(designId, {
          role: "assistant",
          content: `New section added to the design: "${prompt}"`,
          editType: "add-section",
        });

        const newSource = useEditorStore.getState().source;
        await fetch(`/api/designs/${designId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: newSource }),
        });
      } else {
        setStreamingToIframe(false);
        addMessage(designId, {
          role: "assistant",
          content: "Something went wrong adding the section. Please try again.",
        });
      }
    },
    [source, designId, addSectionAfterStream, addMessage, setStreamingToIframe],
  );

  const handleRemoveElement = useCallback(
    (bfId: string) => {
      deleteElement(bfId);

      // Save after deletion
      const newSource = useEditorStore.getState().source;
      fetch(`/api/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: newSource }),
      });
    },
    [designId, deleteElement],
  );

  // ─── Properties Panel code change handler ──────────────────────────

  const handlePropertiesCodeChange = useCallback(
    (newCode: string) => {
      updateSource(newCode);
      fetch(`/api/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: newCode }),
      });
    },
    [designId, updateSource],
  );

  // ─── Version restore handler ─────────────────────────────────────

  const handleVersionRestore = useCallback(
    (html: string) => {
      updateSource(html);
    },
    [updateSource],
  );

  // ─── Keyboard shortcuts ───────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const isMod = e.metaKey || e.ctrlKey;

      if (isMod && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (isMod && e.key === "z" && e.shiftKey) ||
        (isMod && e.key === "y")
      ) {
        e.preventDefault();
        redo();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedBfId &&
        mode === "design"
      ) {
        e.preventDefault();
        handleRemoveElement(selectedBfId);
      } else if (e.key === "Escape") {
        setSelectedBfId(null);
      }
    },
    [undo, redo, handleRemoveElement, selectedBfId, setSelectedBfId, mode],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Top: Toolbar */}
      {mode !== "preview" && (
        <div className="shrink-0">
          <Toolbar
            designName={designName}
            isStyleGuide={isStyleGuide}
            isProjectDesign={!!projectId}
            onGenerate={() => {
              // If design has content AND is a project design, show regeneration modal
              if (source.trim() && projectId && pageId) {
                setRegenModalOpen(true);
              } else {
                setStylePickerOpen(true);
              }
            }}
          />
        </div>
      )}

      {/* Main editor area */}
      <div className="relative flex min-h-0 flex-1">
        {/* Left: AI Chat overlay */}
        <AnimatePresence>
          {showChat && mode !== "preview" && (
            <EditorChatPanel
              designId={designId}
              onEditDesign={handleEditDesign}
              onElementEdit={handleElementEdit}
              onAddSection={handleAddSection}
              isGenerating={isGenerating}
              projectContext={projectContext}
            />
          )}
        </AnimatePresence>

        {/* Left: Layers panel (design mode, toggled) */}
        {mode === "design" && showLayers && (
          <div className="w-56 shrink-0 border-r border-border/60 bg-background">
            <LayersPanel iframeRef={iframeRef} />
          </div>
        )}

        {/* Center: Canvas / Code / Preview */}
        <div className="relative min-w-0 flex-1">
          {mode === "code" && <CodePanel />}
          <div className={mode === "code" ? "hidden" : "h-full"}>
            <Canvas iframeRef={iframeRef} />
          </div>

          {/* Streaming indicator (floating pill) */}
          <StreamingIndicator
            phase={streamPhase}
            onCancel={cancelStream}
          />
        </div>

        {/* Right: Properties panel (design mode, toggled) */}
        {mode === "design" && showProperties && (
          <div className="w-72 shrink-0 border-l border-border/60 bg-background">
            <PropertiesPanel
              designCode={source}
              onCodeChange={handlePropertiesCodeChange}
            />
          </div>
        )}

        {/* Right: Version history (toggled) */}
        {showHistory && (
          <div className="w-64 shrink-0 border-l border-border/60 bg-background">
            <VersionHistory onRestore={handleVersionRestore} />
          </div>
        )}
      </div>

      {/* Style picker modal */}
      <StylePickerModal
        open={stylePickerOpen}
        onOpenChange={setStylePickerOpen}
        onGenerate={handleGenerateDesign}
      />

      {/* Regeneration modal (project designs with content) */}
      {projectId && pageId && (
        <RegenerationModal
          open={regenModalOpen}
          onOpenChange={setRegenModalOpen}
          projectId={projectId}
          pageId={pageId}
          designId={designId}
          isStyleGuide={isStyleGuide}
          onRegenerationComplete={(html) => {
            updateSource(html);
            // Save to DB
            fetch(`/api/designs/${designId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ html }),
            });
          }}
          onRevert={async (previousHtml) => {
            updateSource(previousHtml);
            await fetch(`/api/designs/${designId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ html: previousHtml }),
            });
          }}
          onUpdateAll={() => {
            if (pageId) {
              regenerateAllDesigns(pageId);
            }
          }}
        />
      )}

      {/* Upgrade modal (shown on 429) */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature="You've reached your design generation limit. Upgrade to continue."
      />
    </div>
  );
}
