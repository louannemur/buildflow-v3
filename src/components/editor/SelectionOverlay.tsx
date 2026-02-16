"use client";

import type { EditorElement } from "@/lib/editor/store";

function OverlayBox({
  element,
  type,
}: {
  element: EditorElement;
  type: "selection" | "hover";
}) {
  const { top, left, width, height } = element.rect;

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
          : "1px dashed rgba(59, 130, 246, 0.4)",
        borderRadius: "2px",
        background: isSelection
          ? "rgba(59, 130, 246, 0.06)"
          : "rgba(59, 130, 246, 0.03)",
      }}
    >
      {isSelection && (
        <div className="absolute -top-5 left-0 flex items-center gap-1 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap shadow-sm">
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

interface SelectionOverlayProps {
  selectedElement: EditorElement | null;
  hoveredElement: EditorElement | null;
}

export function SelectionOverlay({
  selectedElement,
  hoveredElement,
}: SelectionOverlayProps) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 10,
        overflow: "hidden",
      }}
    >
      {hoveredElement &&
        hoveredElement.bfId !== selectedElement?.bfId && (
          <OverlayBox element={hoveredElement} type="hover" />
        )}
      {selectedElement && (
        <OverlayBox element={selectedElement} type="selection" />
      )}
    </div>
  );
}
