"use client";

import { useRef, useEffect, useCallback, useState, useMemo } from "react";
import { X } from "lucide-react";
import { useEditorStore, BREAKPOINT_WIDTHS } from "@/lib/editor/store";
import type { EditorElement } from "@/lib/editor/store";
import { generatePreviewHtml, prepareHtmlForPreview, isHtmlDocument } from "@/lib/design/preview-transform";
import { findCodeSiblings } from "@/lib/design/code-mutator";
import { useCurrentUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { SelectionOverlay } from "./SelectionOverlay";
import type { StreamPhase } from "@/hooks/useAIGenerate";
import { ThinkingAnimation, DESIGN_THINKING } from "@/components/features/thinking-animation";

interface CanvasProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onMoveElement?: (bfId: string, targetBfId: string, position: 'before' | 'after') => void;
  streamPhase?: StreamPhase;
}

export function Canvas({ iframeRef, onMoveElement, streamPhase }: CanvasProps) {
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reloadDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBlobUrlRef = useRef<string | null>(null);
  const source = useEditorStore((s) => s.source);
  const mode = useEditorStore((s) => s.mode);
  const breakpoint = useEditorStore((s) => s.breakpoint);
  const setSelectedBfId = useEditorStore((s) => s.setSelectedBfId);
  const setHoveredBfId = useEditorStore((s) => s.setHoveredBfId);
  const setSelectedElement = useEditorStore((s) => s.setSelectedElement);
  const setHoveredElement = useEditorStore((s) => s.setHoveredElement);
  const setElementTree = useEditorStore((s) => s.setElementTree);
  const setIframeScroll = useEditorStore((s) => s.setIframeScroll);
  const setMode = useEditorStore((s) => s.setMode);
  const isStreamingToIframe = useEditorStore((s) => s.isStreamingToIframe);
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const hoveredElement = useEditorStore((s) => s.hoveredElement);
  const { user } = useCurrentUser();
  const isFreePlan = !user?.plan || user.plan === "free";

  const iframeWidth = BREAKPOINT_WIDTHS[breakpoint];

  // ─── Scale-to-fit (width only) ─────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [containerH, setContainerH] = useState(600);

  const recalcScale = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const availableW = el.clientWidth - 32; // p-4 = 16px each side
    const availableH = el.clientHeight - 32;
    setContainerH(availableH);
    setScale(Math.min(1, availableW / iframeWidth));
  }, [iframeWidth]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => recalcScale());
    ro.observe(el);
    recalcScale();
    return () => ro.disconnect();
  }, [recalcScale]);

  // ─── Move element up/down (arrow-based reorder) ───────────────────────
  // Primary: siblings from HTML code structure (depth-tracking).
  // Fallback: element tree (parentBfId) when code-based detection fails.

  const selectedBfIdForMove = selectedElement?.bfId ?? null;
  const elementTree = useEditorStore((s) => s.elementTree);

  const siblings = useMemo(() => {
    if (!selectedBfIdForMove) return { prevBfId: null, nextBfId: null };

    // Primary: element tree (uses actual DOM parent-child relationships via children array)
    if (elementTree.length > 0) {
      const selectedEl = elementTree.find((el) => el.bfId === selectedBfIdForMove);
      if (selectedEl?.parentBfId) {
        const parentEl = elementTree.find((el) => el.bfId === selectedEl.parentBfId);
        if (parentEl?.children && parentEl.children.length > 1) {
          const idx = parentEl.children.indexOf(selectedBfIdForMove);
          if (idx !== -1) {
            return {
              prevBfId: idx > 0 ? parentEl.children[idx - 1] : null,
              nextBfId: idx < parentEl.children.length - 1 ? parentEl.children[idx + 1] : null,
            };
          }
        }
      }
      // Fallback within tree: filter by parentBfId (for elements whose parent lacks children data)
      if (selectedEl) {
        const parentId = selectedEl.parentBfId;
        const treeSiblings = elementTree.filter((el) => el.parentBfId === parentId);
        if (treeSiblings.length > 1) {
          const idx = treeSiblings.findIndex((el) => el.bfId === selectedBfIdForMove);
          return {
            prevBfId: idx > 0 ? treeSiblings[idx - 1].bfId : null,
            nextBfId: idx >= 0 && idx < treeSiblings.length - 1 ? treeSiblings[idx + 1].bfId : null,
          };
        }
      }
    }

    // Secondary: code-based siblings (for when element tree isn't available yet)
    if (source) {
      const codeSibs = findCodeSiblings(source, selectedBfIdForMove);
      if (codeSibs.prevBfId || codeSibs.nextBfId) return codeSibs;
    }

    return { prevBfId: null, nextBfId: null };
  }, [source, elementTree, selectedBfIdForMove]);

  const handleMoveUp = useCallback(() => {
    if (!siblings.prevBfId || !selectedBfIdForMove || !onMoveElement) return;
    onMoveElement(selectedBfIdForMove, siblings.prevBfId, 'before');
  }, [selectedBfIdForMove, siblings.prevBfId, onMoveElement]);

  const handleMoveDown = useCallback(() => {
    if (!siblings.nextBfId || !selectedBfIdForMove || !onMoveElement) return;
    onMoveElement(selectedBfIdForMove, siblings.nextBfId, 'after');
  }, [selectedBfIdForMove, siblings.nextBfId, onMoveElement]);

  // Build and write preview to iframe
  useEffect(() => {
    if (!source || !iframeRef.current) return;
    if (mode === "code") return;
    if (isStreamingToIframe) return; // Streaming writes directly to iframe

    if (readyTimeoutRef.current) {
      clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }

    const doReload = () => {
      try {
        const iframe = iframeRef.current;
        if (!iframe) return;

        // Generate complete preview HTML with optional bridge for design mode
        let html: string;
        const trimmedSource = source.trim();
        const lowerSource = trimmedSource.toLowerCase();

        if (isHtmlDocument(source)) {
          // Full HTML document — render directly
          html = prepareHtmlForPreview(source, { enableBridge: mode === "design" });
        } else if (
          lowerSource.includes('<!doctype') || lowerSource.includes('<html')
        ) {
          // HTML document with leading content — extract and render
          const doctypeIdx = lowerSource.indexOf('<!doctype');
          const htmlIdx = lowerSource.indexOf('<html');
          const start = doctypeIdx !== -1 ? doctypeIdx : htmlIdx;
          html = prepareHtmlForPreview(trimmedSource.slice(start), { enableBridge: mode === "design" });
        } else if (
          trimmedSource.startsWith('<') &&
          !/^(import\s|'use client'|"use client"|export\s|function\s|const\s|class\s)/.test(trimmedSource)
        ) {
          // HTML fragment (e.g. from corrupted element edit) — wrap in document
          const wrapped = `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<script src="https://cdn.tailwindcss.com"><\/script>\n</head>\n<body>\n${source}\n</body>\n</html>`;
          html = prepareHtmlForPreview(wrapped, { enableBridge: mode === "design" });
        } else {
          // Legacy React/JSX code
          html = generatePreviewHtml(source, { enableBridge: mode === "design" });
        }

        // Inject watermark for free plan
        if (isFreePlan) {
          const watermark = `<div style="position:fixed;bottom:12px;right:12px;z-index:99999;pointer-events:none;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;font-weight:500;padding:4px 10px;border-radius:999px;font-family:system-ui,sans-serif;letter-spacing:0.01em;">Made with Calypso</div>`;
          html = html.replace("</body>", watermark + "</body>");
        }

        // Revoke previous blob URL
        if (prevBlobUrlRef.current) {
          URL.revokeObjectURL(prevBlobUrlRef.current);
        }

        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        prevBlobUrlRef.current = url;
        iframe.src = url;

        readyTimeoutRef.current = setTimeout(() => {
          // Preview timeout - could show a warning
        }, 10000);
      } catch (err) {
        console.error("Preview error:", err);
      }
    };

    // Debounce to prevent thrashing from rapid source changes (e.g. undo spam)
    if (reloadDebounceRef.current) {
      clearTimeout(reloadDebounceRef.current);
    }
    reloadDebounceRef.current = setTimeout(doReload, 150);

    return () => {
      if (reloadDebounceRef.current) {
        clearTimeout(reloadDebounceRef.current);
        reloadDebounceRef.current = null;
      }
      if (readyTimeoutRef.current) {
        clearTimeout(readyTimeoutRef.current);
        readyTimeoutRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- iframeRef is a stable ref
  }, [source, mode, isFreePlan, isStreamingToIframe]);

  // Listen for postMessage events from iframe bridge
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || !data.type) return;

      switch (data.type) {
        case "ELEMENT_CLICK":
          setSelectedBfId(data.bfId);
          if (data.element) {
            setSelectedElement(data.element as EditorElement);
          } else {
            setSelectedElement(null);
          }
          break;

        case "ELEMENT_HOVER":
          setHoveredBfId(data.bfId);
          if (data.element) {
            setHoveredElement(data.element as EditorElement);
          }
          break;

        case "ELEMENT_HOVER_OUT":
          setHoveredBfId(null);
          setHoveredElement(null);
          break;

        case "TREE_DATA":
          if (data.elements && Array.isArray(data.elements)) {
            setElementTree(data.elements as EditorElement[]);
          }
          break;

        case "SCROLL_UPDATE":
          setIframeScroll(data.scrollTop || 0, data.scrollLeft || 0);
          // Re-query selected element to get fresh viewport-relative rect
          {
            const selId = useEditorStore.getState().selectedBfId;
            if (selId && iframeRef.current?.contentWindow) {
              iframeRef.current.contentWindow.postMessage(
                { type: "GET_ELEMENT", bfId: selId },
                "*",
              );
            }
          }
          break;

        case "ELEMENT_DATA":
          if (data.element) {
            const state = useEditorStore.getState();
            if (data.bfId === state.selectedBfId) {
              setSelectedElement(data.element as EditorElement);
            }
          }
          break;

        case "READY":
          if (readyTimeoutRef.current) {
            clearTimeout(readyTimeoutRef.current);
            readyTimeoutRef.current = null;
          }
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: "GET_TREE" }, "*");
            // Restore scroll to selected element after reload to prevent jump-to-top
            const selId = useEditorStore.getState().selectedBfId;
            if (selId) {
              setTimeout(() => {
                if (iframeRef.current?.contentWindow) {
                  iframeRef.current.contentWindow.postMessage(
                    { type: "SCROLL_TO", bfId: selId },
                    "*",
                  );
                }
              }, 50);
            }
          }
          break;

        case "PREVIEW_RENDER_OK":
          if (readyTimeoutRef.current) {
            clearTimeout(readyTimeoutRef.current);
            readyTimeoutRef.current = null;
          }
          break;

        case "PREVIEW_ERROR":
          if (readyTimeoutRef.current) {
            clearTimeout(readyTimeoutRef.current);
            readyTimeoutRef.current = null;
          }
          break;

        // Handle V3-style messages for backwards compat
        case "bf:select":
          setSelectedBfId(data.bfId ?? null);
          break;
        case "bf:hover":
          setHoveredBfId(data.bfId ?? null);
          break;
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- iframeRef is a stable ref
  }, [setSelectedBfId, setHoveredBfId, setSelectedElement, setHoveredElement, setElementTree, setIframeScroll]);

  // Sync selection from parent -> iframe
  const selectedBfId = useEditorStore((s) => s.selectedBfId);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;

    if (selectedBfId) {
      iframe.contentWindow.postMessage({ type: "SCROLL_TO", bfId: selectedBfId }, "*");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- iframeRef is a stable ref
  }, [selectedBfId]);

  // The iframe renders at full breakpoint width; height fills the container
  // after accounting for the scale transform.
  const iframeH = scale < 1 ? containerH / scale : containerH;

  return (
    <div
      ref={containerRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden bg-muted/30 p-4"
    >
      {/* Outer sizer: takes up the scaled dimensions in layout */}
      <div
        style={{
          width: scale < 1 ? iframeWidth * scale : iframeWidth,
          height: containerH,
        }}
      >
        {/* Inner: renders at full size, visually scaled down */}
        <div
          ref={innerRef}
          className={cn(
            "relative overflow-hidden rounded-lg border border-border/60 bg-white shadow-sm transition-all duration-300",
            mode === "preview" && "shadow-none",
          )}
          style={{
            width: iframeWidth,
            height: iframeH,
            transform: scale < 1 ? `scale(${scale})` : undefined,
            transformOrigin: "top left",
          }}
        >
          {/* iframe is always in the DOM so doc.write() streaming works */}
          <iframe
            ref={iframeRef}
            title="Design canvas"
            className={cn(
              "block h-full w-full border-none",
              !source && !isStreamingToIframe && "invisible",
            )}
            sandbox="allow-scripts allow-same-origin"
            tabIndex={-1}
          />
          {source && mode === "design" && (
            <SelectionOverlay
              selectedElement={selectedElement}
              hoveredElement={hoveredElement}
              canMoveUp={!!siblings.prevBfId}
              canMoveDown={!!siblings.nextBfId}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          )}

          {/* ThinkingAnimation overlay — shown while generating before HTML starts streaming */}
          {!source && !isStreamingToIframe && streamPhase && streamPhase !== "idle" && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
              <ThinkingAnimation messages={DESIGN_THINKING} />
            </div>
          )}

          {/* Empty state — no design, not generating */}
          {!source && (!streamPhase || streamPhase === "idle") && !isStreamingToIframe && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-muted">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                    <path d="M12 2L2 7l10 5 10-5-10-5z" />
                    <path d="M2 17l10 5 10-5" />
                    <path d="M2 12l10 5 10-5" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-muted-foreground">No design yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">Click Generate to create a design</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {mode === "preview" && (
        <button
          onClick={() => setMode("design")}
          className="absolute right-4 top-4 z-10 flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-background"
        >
          <X className="size-3.5" />
          Exit Preview
        </button>
      )}
    </div>
  );
}
