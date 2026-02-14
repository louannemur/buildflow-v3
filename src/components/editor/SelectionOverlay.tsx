"use client";

import * as React from "react";
import type { EditorElement } from "@/lib/editor/store";

interface SelectionOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  selectedElement: EditorElement | null;
  hoveredElement: EditorElement | null;
  iframeScrollTop: number;
}

function OverlayBox({
  element,
  type,
  iframeRect,
  containerRect,
  iframeScrollTop,
}: {
  element: EditorElement;
  type: "selection" | "hover";
  iframeRect: DOMRect;
  containerRect: DOMRect;
  iframeScrollTop: number;
}) {
  const top =
    element.rect.top - iframeScrollTop + (iframeRect.top - containerRect.top);
  const left = element.rect.left + (iframeRect.left - containerRect.left);
  const { width, height } = element.rect;

  if (
    top + height < 0 ||
    top > containerRect.height ||
    left + width < 0 ||
    left > containerRect.width
  ) {
    return null;
  }

  const isSelection = type === "selection";

  return (
    <div
      style={{
        position: "absolute",
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
        pointerEvents: "none",
        zIndex: isSelection ? 11 : 10,
        border: isSelection
          ? "2px solid rgb(59, 130, 246)"
          : "1px dashed rgba(59, 130, 246, 0.5)",
        borderRadius: "2px",
      }}
    >
      {isSelection && (
        <div className="absolute -top-5 left-0 flex items-center gap-1 rounded-t bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap">
          <span>{element.tag}</span>
          {element.classes && (
            <span className="opacity-70">
              .{element.classes.split(" ").slice(0, 2).join(".")}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function SelectionOverlay({
  iframeRef,
  selectedElement,
  hoveredElement,
  iframeScrollTop,
}: SelectionOverlayProps) {
  const [iframeRect, setIframeRect] = React.useState<DOMRect | null>(null);
  const [containerRect, setContainerRect] = React.useState<DOMRect | null>(
    null,
  );

  React.useEffect(() => {
    const updateRect = () => {
      const iframe = iframeRef.current;
      if (iframe) {
        setIframeRect(iframe.getBoundingClientRect());
        if (iframe.parentElement) {
          setContainerRect(iframe.parentElement.getBoundingClientRect());
        }
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    const iframe = iframeRef.current;
    const observer = new ResizeObserver(updateRect);
    if (iframe) {
      observer.observe(iframe);
    }

    return () => {
      window.removeEventListener("resize", updateRect);
      observer.disconnect();
    };
  }, [iframeRef]);

  if (!iframeRect || !containerRect) return null;

  return (
    <>
      {hoveredElement &&
        hoveredElement.bfId !== selectedElement?.bfId && (
          <OverlayBox
            element={hoveredElement}
            type="hover"
            iframeRect={iframeRect}
            containerRect={containerRect}
            iframeScrollTop={iframeScrollTop}
          />
        )}
      {selectedElement && (
        <OverlayBox
          element={selectedElement}
          type="selection"
          iframeRect={iframeRect}
          containerRect={containerRect}
          iframeScrollTop={iframeScrollTop}
        />
      )}
    </>
  );
}
