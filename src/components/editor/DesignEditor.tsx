"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useEditorStore } from "@/lib/editor/store";
import { Canvas } from "./canvas";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { CodePanel } from "./CodePanel";
import { Toolbar } from "./Toolbar";
import { PromptBar } from "./PromptBar";
import { PromptChat } from "./PromptChat";
import { StylePickerModal } from "./StylePickerModal";
import type { GenerateConfig } from "./StylePickerModal";
import { SelectionOverlay } from "./SelectionOverlay";
import { StreamingIndicator } from "./StreamingOverlay";
import { ComponentLibrary } from "./ComponentLibrary";
import { useAIGenerate } from "@/hooks/useAIGenerate";
import { useChatHistoryStore } from "@/stores/chat-history-store";
import { UpgradeModal } from "@/components/features/upgrade-modal";
import { COMPONENT_SECTIONS } from "@/lib/design/component-library";
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
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const hoveredElement = useEditorStore((s) => s.hoveredElement);
  const showLayers = useEditorStore((s) => s.showLayers);
  const showProperties = useEditorStore((s) => s.showProperties);
  const showComponents = useEditorStore((s) => s.showComponents);
  const showChat = useEditorStore((s) => s.showChat);
  const iframeScrollTop = useEditorStore((s) => s.iframeScrollTop);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setStreamingToIframe = useEditorStore((s) => s.setStreamingToIframe);


  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);

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
          content: "Design generated",
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
    [source, designId, buildGeneratePrompt, editDesignStream, updateSource, addMessage, getHistory, setStreamingToIframe],
  );

  const handleEditDesign = useCallback(
    async (prompt: string) => {
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
          content: prompt,
          editType: "full-page",
        });
        addMessage(designId, {
          role: "assistant",
          content: "Design updated",
          editType: "full-page",
        });

        await fetch(`/api/designs/${designId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: result }),
        });
      } else {
        setStreamingToIframe(false);
      }
    },
    [source, designId, editDesignStream, updateSource, addMessage, getHistory, setStreamingToIframe],
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
        updateSource(result);
        setStreamingToIframe(false);
        addMessage(designId, {
          role: "user",
          content: prompt,
          editType: "element",
        });
        addMessage(designId, {
          role: "assistant",
          content: `Element <${element?.tag ?? "unknown"}> updated`,
          editType: "element",
        });

        await fetch(`/api/designs/${designId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: result }),
        });
      } else {
        setStreamingToIframe(false);
      }
    },
    [source, designId, modifyElementStream, updateSource, addMessage, setStreamingToIframe],
  );

  const handleAddSection = useCallback(
    async (afterBfId: string, prompt: string) => {
      const result = await addSectionAfterStream(afterBfId, prompt, source);

      if (result) {
        updateSource(result);
        setStreamingToIframe(false);
        addMessage(designId, {
          role: "user",
          content: prompt,
          editType: "add-section",
        });
        addMessage(designId, {
          role: "assistant",
          content: "Section added",
          editType: "add-section",
        });

        await fetch(`/api/designs/${designId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: result }),
        });
      } else {
        setStreamingToIframe(false);
      }
    },
    [source, designId, addSectionAfterStream, updateSource, addMessage, setStreamingToIframe],
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

  // ─── Component Library ─────────────────────────────────────────────

  const handleToggleComponent = useCallback((id: string) => {
    setSelectedComponentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }, []);

  const handleAddComponents = useCallback(async () => {
    if (selectedComponentIds.length === 0) return;

    const sections = selectedComponentIds
      .map((id) => COMPONENT_SECTIONS.find((s) => s.id === id))
      .filter(Boolean);

    const prompt =
      "Add the following sections to the page, matching the existing design style:\n" +
      sections.map((s) => `- ${s!.name}: ${s!.promptSnippet}`).join("\n");

    const lastBfId = useEditorStore.getState().elementTree.at(-1)?.bfId;
    if (lastBfId) {
      await handleAddSection(lastBfId, prompt);
    } else {
      await handleEditDesign(prompt);
    }

    setSelectedComponentIds([]);
  }, [selectedComponentIds, handleAddSection, handleEditDesign]);

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
            onGenerate={() => setStylePickerOpen(true)}
          />
        </div>
      )}

      {/* Main editor area */}
      <div className="relative flex min-h-0 flex-1">
        {/* Left: Layers panel (design mode, toggled) */}
        {mode === "design" && showLayers && (
          <div className="w-56 shrink-0 border-r border-border/60 bg-background">
            <LayersPanel iframeRef={iframeRef} />
          </div>
        )}

        {/* Center: Canvas / Code / Preview */}
        <div className="relative min-w-0 flex-1">
          {mode === "code" ? (
            <CodePanel />
          ) : (
            <>
              <Canvas iframeRef={iframeRef} />
              {mode === "design" && (
                <SelectionOverlay
                  iframeRef={iframeRef}
                  selectedElement={selectedElement}
                  hoveredElement={hoveredElement}
                  iframeScrollTop={iframeScrollTop}
                />
              )}
            </>
          )}

          {/* Streaming indicator (floating pill) */}
          <StreamingIndicator
            phase={streamPhase}
            onCancel={cancelStream}
          />
        </div>

        {/* Right: Properties panel (design mode, toggled) */}
        {mode === "design" && showProperties && (
          <div className="w-64 shrink-0 border-l border-border/60 bg-background">
            <PropertiesPanel
              designCode={source}
              onCodeChange={handlePropertiesCodeChange}
            />
          </div>
        )}

        {/* Right: Components library (design mode, toggled) */}
        {mode === "design" && showComponents && (
          <ComponentLibrary
            selectedIds={selectedComponentIds}
            onToggleSection={handleToggleComponent}
            onAddSelected={handleAddComponents}
            onClose={() => useEditorStore.getState().toggleComponents()}
          />
        )}
      </div>

      {/* Bottom: Chat history (toggled) */}
      {showChat && (
        <div className="shrink-0">
          <PromptChat designId={designId} />
        </div>
      )}

      {/* Bottom: Prompt bar */}
      {mode !== "preview" && (
        <div className="shrink-0">
          <PromptBar
            onEditDesign={handleEditDesign}
            onElementEdit={handleElementEdit}
            onAddSection={handleAddSection}
            isGenerating={isGenerating}
            projectContext={projectContext}
          />
        </div>
      )}

      {/* Style picker modal */}
      <StylePickerModal
        open={stylePickerOpen}
        onOpenChange={setStylePickerOpen}
        onGenerate={handleGenerateDesign}
      />

      {/* Upgrade modal (shown on 429) */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        feature="You've reached your design generation limit. Upgrade to continue."
      />
    </div>
  );
}
