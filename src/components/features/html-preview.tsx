"use client";

import { useRef, useEffect, useState, useMemo } from "react";

const IFRAME_W = 1280;
const IFRAME_H = 800;

export function HtmlPreview({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.25);
  const [visible, setVisible] = useState(false);

  // Only render iframe when scrolled into view
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Resize scale
  useEffect(() => {
    if (!visible) return;
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / IFRAME_W);
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    update();
    return () => ro.disconnect();
  }, [visible]);

  // Build srcdoc content (avoids contentDocument access on sandboxed iframe)
  const srcdoc = useMemo(() => {
    const lower = html.trimStart().toLowerCase();
    const isFullDoc = lower.startsWith("<!doctype") || lower.startsWith("<html");

    if (isFullDoc) {
      // Inject preview style before </head> (case-insensitive search)
      const headCloseIdx = html.search(/<\/head>/i);
      if (headCloseIdx !== -1) {
        return (
          html.slice(0, headCloseIdx) +
          `<style>body{overflow:hidden;pointer-events:none;}</style>` +
          html.slice(headCloseIdx)
        );
      }
      return html;
    }

    // Fragment — wrap in a full document with Tailwind CDN for utility classes
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><script src="https://cdn.tailwindcss.com"><\/script><style>body{margin:0;overflow:hidden;transform-origin:top left;pointer-events:none;}</style></head><body>${html}</body></html>`;
  }, [html]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {visible && (
        <iframe
          title="Design preview"
          className="pointer-events-none origin-top-left border-none"
          style={{
            width: IFRAME_W,
            height: IFRAME_H,
            transform: `scale(${scale})`,
          }}
          srcDoc={srcdoc}
          sandbox="allow-scripts"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
