"use client";

import { useRef, useEffect, useState } from "react";

const IFRAME_W = 1280;
const IFRAME_H = 800;

export function HtmlPreview({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
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

  // Write HTML into iframe
  useEffect(() => {
    if (!visible) return;
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    const isFullDoc =
      html.trimStart().startsWith("<!DOCTYPE") ||
      html.trimStart().startsWith("<html");

    doc.open();
    if (isFullDoc) {
      const styled = html.replace(
        "</head>",
        `<style>body{overflow:hidden;pointer-events:none;}</style></head>`,
      );
      doc.write(styled);
    } else {
      doc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body {
                margin: 0;
                overflow: hidden;
                transform-origin: top left;
                pointer-events: none;
              }
            </style>
          </head>
          <body>${html}</body>
        </html>
      `);
    }
    doc.close();
  }, [html, visible]);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden">
      {visible && (
        <iframe
          ref={iframeRef}
          title="Design preview"
          className="pointer-events-none origin-top-left border-none"
          style={{
            width: IFRAME_W,
            height: IFRAME_H,
            transform: `scale(${scale})`,
          }}
          sandbox="allow-scripts allow-same-origin"
          tabIndex={-1}
        />
      )}
    </div>
  );
}
