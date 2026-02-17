"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { useEditorStore, BREAKPOINT_WIDTHS } from "@/lib/editor/store";
import type { EditorElement } from "@/lib/editor/store";
import { generatePreviewHtml, prepareHtmlForPreview, isHtmlDocument } from "@/lib/design/preview-transform";
import { useCurrentUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { SelectionOverlay } from "./SelectionOverlay";

interface CanvasProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  onMoveElement?: (bfId: string, targetBfId: string, position: 'before' | 'after') => void;
}

export function Canvas({ iframeRef, onMoveElement }: CanvasProps) {
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

  // ─── Drag-to-reorder state ─────────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const [dropIndicator, setDropIndicator] = useState<{ y: number; width: number; left: number } | null>(null);
  const dropTargetRef = useRef<{ bfId: string; position: 'before' | 'after' } | null>(null);
  const dragBfIdRef = useRef<string | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    const draggedEl = useEditorStore.getState().selectedElement;
    if (!draggedEl) return;

    e.preventDefault();
    setIsDragging(true);
    dragBfIdRef.current = draggedEl.bfId;

    const handleMouseMove = (ev: MouseEvent) => {
      const inner = innerRef.current;
      if (!inner) return;

      // Convert mouse position to iframe coordinates
      const rect = inner.getBoundingClientRect();
      const iframeY = (ev.clientY - rect.top) / scale;

      const state = useEditorStore.getState();
      const dragged = state.elementTree.find((el) => el.bfId === dragBfIdRef.current);
      if (!dragged) return;

      // Find siblings (same parent, exclude dragged element)
      const siblings = state.elementTree.filter(
        (el) => el.parentBfId === dragged.parentBfId && el.bfId !== dragged.bfId,
      );
      siblings.sort((a, b) => a.rect.top - b.rect.top);

      if (siblings.length === 0) {
        dropTargetRef.current = null;
        setDropIndicator(null);
        return;
      }

      // Find drop position based on cursor Y
      let target: EditorElement | null = null;
      let position: 'before' | 'after' = 'before';

      for (const sibling of siblings) {
        const midY = sibling.rect.top + sibling.rect.height / 2;
        if (iframeY < midY) {
          target = sibling;
          position = 'before';
          break;
        }
      }

      if (!target) {
        target = siblings[siblings.length - 1];
        position = 'after';
      }

      // Check if this would result in no change
      const allChildren = state.elementTree
        .filter((el) => el.parentBfId === dragged.parentBfId)
        .sort((a, b) => a.rect.top - b.rect.top);
      const draggedIndex = allChildren.findIndex((el) => el.bfId === dragged.bfId);
      const targetIndex = allChildren.findIndex((el) => el.bfId === target!.bfId);

      const isNoOp =
        (position === 'before' && draggedIndex === targetIndex - 1) ||
        (position === 'after' && draggedIndex === targetIndex + 1) ||
        (position === 'before' && draggedIndex === 0 && targetIndex === 0) ||
        (position === 'after' && draggedIndex === allChildren.length - 1 && targetIndex === allChildren.length - 1);

      if (isNoOp) {
        dropTargetRef.current = null;
        setDropIndicator(null);
        return;
      }

      dropTargetRef.current = { bfId: target.bfId, position };

      // Calculate indicator line position
      const lineY = position === 'before' ? target.rect.top : target.rect.top + target.rect.height;
      const parentEl = state.elementTree.find((el) => el.bfId === dragged.parentBfId);
      const lineWidth = parentEl ? parentEl.rect.width : target.rect.width;
      const lineLeft = parentEl ? parentEl.rect.left : target.rect.left;

      setDropIndicator({ y: lineY, width: lineWidth, left: lineLeft });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      setIsDragging(false);
      setDropIndicator(null);

      const bfId = dragBfIdRef.current;
      const drop = dropTargetRef.current;
      dragBfIdRef.current = null;
      dropTargetRef.current = null;

      if (bfId && drop && onMoveElement) {
        onMoveElement(bfId, drop.bfId, drop.position);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [scale, onMoveElement]);

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
          {source ? (
            <>
              <iframe
                ref={iframeRef}
                title="Design canvas"
                className="block h-full w-full border-none"
                sandbox="allow-scripts allow-same-origin"
                tabIndex={-1}
              />
              {mode === "design" && (
                <SelectionOverlay
                  selectedElement={selectedElement}
                  hoveredElement={hoveredElement}
                  onDragStart={handleDragStart}
                  dropIndicator={dropIndicator}
                />
              )}
              {/* Transparent overlay to capture mouse events during drag (iframe blocks them otherwise) */}
              {isDragging && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    zIndex: 50,
                    cursor: "grabbing",
                    userSelect: "none",
                  }}
                />
              )}
            </>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
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
