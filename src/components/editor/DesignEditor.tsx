"use client";

import { useEffect, useCallback, useState, useRef } from "react";
import { useEditorStore, getCleanSource } from "@/lib/editor/store";
import { stripBfIds } from "@/lib/design/inject-bf-ids";
import { findElementInCode, getOpeningTag, moveElement } from "@/lib/design/code-mutator";
import { Canvas } from "./canvas";
import { LayersPanel } from "./LayersPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { CodePanel } from "./CodePanel";
import { Toolbar } from "./Toolbar";
import { StylePickerModal } from "./StylePickerModal";
import { RegenerationModal } from "./RegenerationModal";
import type { RegenerateConfig } from "./RegenerationModal";
import { StyleMismatchBar } from "./StyleMismatchModal";
import { StreamingIndicator } from "./StreamingOverlay";
import { useProjectStore } from "@/stores/project-store";
import { VersionHistory } from "./VersionHistory";
import { useAIGenerate } from "@/hooks/useAIGenerate";
import { useGlobalChatStore } from "@/stores/global-chat-store";
import { UpgradeModal } from "@/components/features/upgrade-modal";
import { extractHtmlFromStream } from "@/lib/ai/extract-code";
import { readSSEStream } from "@/lib/sse-client";
import { toast } from "sonner";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";


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
  const showHistory = useEditorStore((s) => s.showHistory);
  const deleteElement = useEditorStore((s) => s.deleteElement);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const setStreamingToIframe = useEditorStore((s) => s.setStreamingToIframe);
  const setBreakpoint = useEditorStore((s) => s.setBreakpoint);


  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [stylePickerOpen, setStylePickerOpen] = useState(false);
  const [regenModalOpen, setRegenModalOpen] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);

  // Style mismatch detection (post-regeneration)
  const [styleMismatchOpen, setStyleMismatchOpen] = useState(false);
  const [previousHtmlForRevert, setPreviousHtmlForRevert] = useState<string | null>(null);
  const [isUpdatingOtherPages, setIsUpdatingOtherPages] = useState(false);


  // Refs for live iframe streaming
  const streamHtmlStartedRef = useRef(false);
  const streamPrevHtmlLenRef = useRef(0);

  // AI generation
  const {
    generateDesignStreamAction,
    editDesignStream,
    modifyElementStream,
    addSectionAfterStream,
    showUpgradeModal,
    setShowUpgradeModal,
    streamPhase,
    cancelStream,
    setOnStreamChunk,
  } = useAIGenerate();

  // Warn before leaving during active streaming/regeneration
  useUnsavedChanges(streamPhase !== "idle" || isRegenerating);

  const globalChatAddMessage = useGlobalChatStore((s) => s.addMessage);

  const addMessage = useCallback(
    (msg: { role: "user" | "assistant"; content: string; editType?: "full-page" | "element" | "add-section" | "general" }) => {
      globalChatAddMessage({
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...msg,
        intent: "design_edit",
      });
    },
    [globalChatAddMessage],
  );

  const getChatHistory = useCallback(() => {
    return useGlobalChatStore.getState().messages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  }, []);

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

  // Auto-generate (from chat navigation) or auto-open style picker when design has no code
  const initialActionRef = useRef(false);
  useEffect(() => {
    if (initialActionRef.current || initialCode.trim()) return;
    initialActionRef.current = true;

    // Effects only run client-side, so window is always available here
    const params = new URLSearchParams(window.location.search);
    const isAutoGenerate = params.get("autoGenerate") === "true";

    if (isAutoGenerate) {
      // Clean up URL param
      const url = new URL(window.location.href);
      url.searchParams.delete("autoGenerate");
      window.history.replaceState({}, "", url.toString());
    }

    // Only auto-generate when explicitly triggered (e.g. from chat navigation)
    if (isAutoGenerate) {
      if (styleGuideCode && projectId && pageId) {
        handleRegenerate({ useStyleGuide: true });
      } else {
        handleGenerateDesign("surprise");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only run once on mount
  }, []);

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
    (config: "surprise" | string): string => {
      const parts: string[] = [
        "Generate a complete, beautiful, Awwwards-quality design.",
      ];

      if (config === "surprise") {
        parts.push(
          "Pick a creative, visually striking style. Surprise the user with something unique and polished.",
        );
      } else {
        // User provided a free-form prompt
        parts.push(config);
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
    async (config: "surprise" | string) => {
      setStylePickerOpen(false);
      setSelectedBfId(null);

      const prompt = buildGeneratePrompt(config);
      const label =
        config === "surprise"
          ? "Surprise me"
          : `Generate design: ${config.slice(0, 60)}${config.length > 60 ? "..." : ""}`;

      // Use full design generation (Gemini) for initial generation,
      // and edit (Claude) when modifying an existing design
      const hasExistingDesign = source && source.trim().length > 0;
      const result = hasExistingDesign
        ? await editDesignStream(prompt, source, getChatHistory())
        : await generateDesignStreamAction(prompt);

      if (result) {
        updateSource(result);
        setStreamingToIframe(false);
        addMessage({
          role: "user",
          content: label,
          editType: "full-page",
        });
        addMessage({
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
    [source, designId, buildGeneratePrompt, editDesignStream, generateDesignStreamAction, updateSource, addMessage, getChatHistory, setStreamingToIframe, setSelectedBfId],
  );

  const handleEditDesign = useCallback(
    async (prompt: string) => {
      setSelectedBfId(null);
      const result = await editDesignStream(
        prompt,
        source,
        getChatHistory(),
      );

      if (result) {
        updateSource(result);
        setStreamingToIframe(false);
        addMessage({
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
        addMessage({
          role: "assistant",
          content: "Something went wrong. Please try again.",
        });
      }
    },
    [source, designId, editDesignStream, updateSource, addMessage, getChatHistory, setStreamingToIframe, setSelectedBfId],
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
        addMessage({
          role: "assistant",
          content: `Updated the <${element?.tag ?? "element"}> — applied: "${prompt}"`,
          editType: "element",
        });

        await fetch(`/api/designs/${designId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: getCleanSource() }),
        });
      } else {
        setStreamingToIframe(false);
        addMessage({
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
        addMessage({
          role: "assistant",
          content: `New section added to the design: "${prompt}"`,
          editType: "add-section",
        });

        await fetch(`/api/designs/${designId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: getCleanSource() }),
        });
      } else {
        setStreamingToIframe(false);
        addMessage({
          role: "assistant",
          content: "Something went wrong adding the section. Please try again.",
        });
      }
    },
    [source, designId, addSectionAfterStream, addMessage, setStreamingToIframe],
  );

  // Register editor callbacks so the global chat can dispatch design edits
  useEffect(() => {
    const store = useGlobalChatStore.getState();
    store.registerEditorCallbacks({
      onEditDesign: handleEditDesign,
      onElementEdit: handleElementEdit,
      onAddSection: handleAddSection,
    });

    // Check for a pending editor prompt (e.g. from home page chat navigation)
    const pendingPrompt = store.pendingEditorPrompt;
    if (pendingPrompt) {
      store.setPendingEditorPrompt(null);
      // If page has a design, edit it; otherwise generate first
      if (source.trim()) {
        // Small delay to let the editor fully mount
        setTimeout(() => handleEditDesign(pendingPrompt), 500);
      } else if (styleGuideCode && projectId && pageId) {
        handleRegenerate({ useStyleGuide: true });
      } else {
        handleGenerateDesign("surprise");
      }
    }

    return () => {
      useGlobalChatStore.getState().unregisterEditorCallbacks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-register when callbacks change
  }, [handleEditDesign, handleElementEdit, handleAddSection]);

  const handleRemoveElement = useCallback(
    (bfId: string) => {
      deleteElement(bfId);

      // Save after deletion
      fetch(`/api/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: getCleanSource() }),
      });
    },
    [designId, deleteElement],
  );

  // ─── Properties Panel code change handler ──────────────────────────

  const handlePropertiesCodeChange = useCallback(
    (newCode: string) => {
      const state = useEditorStore.getState();
      const bfId = state.selectedBfId;
      const oldSource = state.source;

      updateSource(newCode);

      // Send postMessage for instant visual feedback (iframe reload is the safety net)
      const iframe = iframeRef.current;
      if (bfId && iframe?.contentWindow) {
        const newLoc = findElementInCode(newCode, bfId);
        const oldLoc = findElementInCode(oldSource, bfId);
        if (newLoc) {
          // Always send class update
          iframe.contentWindow.postMessage(
            { type: "UPDATE_CLASSES", bfId, classes: newLoc.classes },
            "*",
          );

          // Detect text changes and send UPDATE_TEXT for instant feedback
          if (oldLoc && !newLoc.selfClosing && !oldLoc.selfClosing) {
            const oldTag = getOpeningTag(oldSource, oldLoc.start);
            const newTag = getOpeningTag(newCode, newLoc.start);
            if (oldTag && newTag) {
              const oldText = oldSource.slice(oldTag.end, oldLoc.end - `</${oldLoc.tag}>`.length);
              const newText = newCode.slice(newTag.end, newLoc.end - `</${newLoc.tag}>`.length);
              if (oldText !== newText) {
                iframe.contentWindow.postMessage(
                  { type: "UPDATE_TEXT", bfId, newText: newText.trim() },
                  "*",
                );
              }
            }
          }

          // Send inline color styles for instant visual feedback
          const tagInfo = getOpeningTag(newCode, newLoc.start);
          if (tagInfo) {
            const sMatch = tagInfo.content.match(/\bstyle\s*=\s*"([^"]*)"/);
            if (sMatch) {
              const inlineStyle = sMatch[1];
              const colorMappings: [string, string][] = [
                ["color", "color"],
                ["background-color", "backgroundColor"],
                ["border-color", "borderColor"],
              ];
              for (const [css, js] of colorMappings) {
                const pMatch = inlineStyle.match(
                  new RegExp(`(?:^|;)\\s*${css.replace(/-/g, "\\-")}\\s*:\\s*([^;]+)`)
                );
                if (pMatch) {
                  // Strip !important — bridge applies it automatically via setProperty
                  const colorVal = pMatch[1].trim().replace(/\s*!important\s*$/i, "").trim();
                  iframe.contentWindow.postMessage(
                    { type: "UPDATE_STYLE", bfId, prop: js, value: colorVal },
                    "*",
                  );
                }
              }
            }
          }
        }
      }

      fetch(`/api/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: stripBfIds(newCode) }),
      });
    },
    [designId, updateSource],
  );

  // ─── Move element handler (drag-to-reorder) ─────────────────────

  const handleMoveElement = useCallback(
    (bfId: string, targetBfId: string, position: 'before' | 'after') => {
      const currentSource = useEditorStore.getState().source;
      const newSource = moveElement(currentSource, bfId, targetBfId, position);
      if (newSource !== currentSource) {
        updateSource(newSource);
        fetch(`/api/designs/${designId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: stripBfIds(newSource) }),
        });
      }
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

  // ─── Regeneration (project designs) ─────────────────────────────

  const handleRegenerate = useCallback(
    async (config: RegenerateConfig) => {
      setRegenModalOpen(false);
      setSelectedBfId(null);
      setIsRegenerating(true);
      setStreamingToIframe(true);
      streamHtmlStartedRef.current = false;
      streamPrevHtmlLenRef.current = 0;

      // Capture current source for revert
      const sourceBeforeRegen = source;

      let accumulated = "";
      let receivedDone = false;

      const resetStreamState = () => {
        setStreamingToIframe(false);
        setIsRegenerating(false);
        streamHtmlStartedRef.current = false;
        streamPrevHtmlLenRef.current = 0;
      };

      try {
        const response = await fetch(
          `/api/projects/${projectId}/designs/generate`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              pageId,
              stream: true,
              forceRegenerate: true,
              skipReview: true,
              useStyleGuide: config.useStyleGuide,
              stylePrompt: config.stylePrompt,
            }),
          },
        );

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          console.error("Regeneration failed:", response.status, errorText);
          if (response.status === 429) {
            setShowUpgradeModal(true);
          } else {
            toast.error("Failed to regenerate design. Please try again.");
          }
          resetStreamState();
          return;
        }

        await readSSEStream(response, {
          onEvent: (event) => {
            if (event.type === "chunk" && typeof event.text === "string") {
              accumulated += event.text;
              const iframe = iframeRef.current;
              if (!iframe) return;

              const { htmlStarted, htmlContent } =
                extractHtmlFromStream(accumulated);
              if (!htmlStarted) return;

              if (!streamHtmlStartedRef.current) {
                streamHtmlStartedRef.current = true;
                streamPrevHtmlLenRef.current = 0;
                try {
                  const doc =
                    iframe.contentDocument || iframe.contentWindow?.document;
                  if (doc) {
                    doc.open();
                    doc.write(htmlContent);
                    streamPrevHtmlLenRef.current = htmlContent.length;
                  }
                } catch (e) {
                  console.error("Streaming write error:", e);
                }
              } else {
                const newContent = htmlContent.slice(
                  streamPrevHtmlLenRef.current,
                );
                streamPrevHtmlLenRef.current = htmlContent.length;
                if (newContent) {
                  try {
                    const doc =
                      iframe.contentDocument || iframe.contentWindow?.document;
                    if (doc) {
                      doc.write(newContent);
                    }
                  } catch (e) {
                    console.error("Streaming write error:", e);
                  }
                }
              }
            } else if (event.type === "done" && event.design) {
              receivedDone = true;
              const design = event.design as { html: string; previousHtml?: string };
              if (design.html) {
                updateSource(design.html);
                addMessage({
                  role: "assistant",
                  content: "Design regenerated!",
                  editType: "full-page",
                });

                // If regenerated without following the style guide, prompt user
                if (!config.useStyleGuide && !isStyleGuide) {
                  setPreviousHtmlForRevert(
                    design.previousHtml || sourceBeforeRegen || null,
                  );
                  setStyleMismatchOpen(true);
                }
              }
              resetStreamState();
            }
          },
          onError: (err) => {
            console.error("Regeneration stream error:", err);
            toast.error("Generation failed. Please try again.");
            resetStreamState();
          },
        });

        // Safety net: if stream ended without done/error, still clean up
        if (!receivedDone) {
          if (accumulated) {
            const { htmlContent } = extractHtmlFromStream(accumulated);
            if (htmlContent) {
              updateSource(htmlContent);
            }
          }
          resetStreamState();
        }
      } catch (err) {
        console.error("Regeneration error:", err);
        toast.error("Something went wrong. Please try again.");
        resetStreamState();
      }
    },
    [projectId, pageId, designId, source, isStyleGuide, updateSource, addMessage, setStreamingToIframe, setSelectedBfId, setShowUpgradeModal],
  );

  // ─── Style mismatch handlers ──────────────────────────────────────

  const handleMakeStyleGuide = useCallback(async () => {
    setIsUpdatingOtherPages(true);
    try {
      await fetch(`/api/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isStyleGuide: true }),
      });

      if (pageId) {
        useProjectStore.getState().regenerateAllDesigns(pageId);
      }

      toast.success("Style guide updated. Regenerating other pages...");
    } catch {
      toast.error("Failed to update style guide");
    } finally {
      setIsUpdatingOtherPages(false);
      setStyleMismatchOpen(false);
      setPreviousHtmlForRevert(null);
    }
  }, [designId, pageId]);

  const handleRegenerateAgain = useCallback(() => {
    setStyleMismatchOpen(false);
    setPreviousHtmlForRevert(null);
    setRegenModalOpen(true);
  }, []);

  const handleRevertToStyleGuide = useCallback(async () => {
    if (!previousHtmlForRevert) return;

    updateSource(previousHtmlForRevert);

    await fetch(`/api/designs/${designId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html: previousHtmlForRevert }),
    });

    addMessage({
      role: "assistant",
      content: "Reverted to the previous version.",
      editType: "full-page",
    });

    setStyleMismatchOpen(false);
    setPreviousHtmlForRevert(null);
  }, [previousHtmlForRevert, designId, updateSource, addMessage]);

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
            <Canvas iframeRef={iframeRef} onMoveElement={handleMoveElement} streamPhase={isRegenerating ? "streaming" : streamPhase} />
          </div>

          {/* Style mismatch bar (non-blocking, bottom of canvas) */}
          {projectId && pageId && (
            <StyleMismatchBar
              visible={styleMismatchOpen}
              onMakeStyleGuide={handleMakeStyleGuide}
              onRegenerateAgain={handleRegenerateAgain}
              onRevert={handleRevertToStyleGuide}
              isUpdatingOtherPages={isUpdatingOtherPages}
            />
          )}
        </div>

        {/* Streaming indicator (floating pill — positioned over the full editor area) */}
        <StreamingIndicator
          phase={isRegenerating ? "streaming" : streamPhase}
          onCancel={isRegenerating ? undefined : cancelStream}
        />

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
          isStyleGuide={isStyleGuide}
          onRegenerate={handleRegenerate}
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
