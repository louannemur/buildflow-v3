"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { X } from "lucide-react";
import { useEditorStore, BREAKPOINT_WIDTHS } from "@/lib/editor/store";
import type { EditorElement } from "@/lib/editor/store";
import { generatePreviewHtml, prepareHtmlForPreview, isHtmlDocument } from "@/lib/design/preview-transform";
import { useCurrentUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface CanvasProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

export function Canvas({ iframeRef }: CanvasProps) {
  const readyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const { user } = useCurrentUser();
  const isFreePlan = !user?.plan || user.plan === "free";

  const iframeWidth = BREAKPOINT_WIDTHS[breakpoint];

  // ─── Scale-to-fit (width only) ─────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Build and write preview to iframe
  useEffect(() => {
    if (!source || !iframeRef.current) return;
    if (mode === "code") return;
    if (isStreamingToIframe) return; // Streaming writes directly to iframe

    if (readyTimeoutRef.current) {
      clearTimeout(readyTimeoutRef.current);
      readyTimeoutRef.current = null;
    }

    try {
      // Generate complete preview HTML with optional bridge for design mode
      let html: string;
      if (isHtmlDocument(source)) {
        html = prepareHtmlForPreview(source, { enableBridge: mode === "design" });
      } else {
        html = generatePreviewHtml(source, { enableBridge: mode === "design" });
      }

      // Inject watermark for free plan
      if (isFreePlan) {
        const watermark = `<div style="position:fixed;bottom:12px;right:12px;z-index:99999;pointer-events:none;background:rgba(0,0,0,0.6);color:#fff;font-size:11px;font-weight:500;padding:4px 10px;border-radius:999px;font-family:system-ui,sans-serif;letter-spacing:0.01em;">Made with BuildFlow</div>`;
        html = html.replace("</body>", watermark + "</body>");
      }

      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      iframeRef.current.src = url;

      readyTimeoutRef.current = setTimeout(() => {
        // Preview timeout - could show a warning
      }, 10000);

      return () => {
        URL.revokeObjectURL(url);
        if (readyTimeoutRef.current) {
          clearTimeout(readyTimeoutRef.current);
          readyTimeoutRef.current = null;
        }
      };
    } catch (err) {
      console.error("Preview error:", err);
    }
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
          break;

        case "READY":
          if (readyTimeoutRef.current) {
            clearTimeout(readyTimeoutRef.current);
            readyTimeoutRef.current = null;
          }
          if (iframeRef.current?.contentWindow) {
            iframeRef.current.contentWindow.postMessage({ type: "GET_TREE" }, "*");
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
            <iframe
              ref={iframeRef}
              title="Design canvas"
              className="block h-full w-full border-none"
              sandbox="allow-scripts allow-same-origin"
              tabIndex={-1}
            />
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
