"use client";

import { GripVertical } from "lucide-react";
import type { EditorElement } from "@/lib/editor/store";

function OverlayBox({
  element,
  type,
  onDragStart,
}: {
  element: EditorElement;
  type: "selection" | "hover";
  onDragStart?: (e: React.MouseEvent) => void;
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
        <>
          <div className="absolute -top-5 left-0 flex items-center gap-1 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-medium text-white whitespace-nowrap shadow-sm">
            <span>{element.tag}</span>
            {element.classes && (
              <span className="opacity-70">
                .{element.classes.split(" ").slice(0, 2).join(".")}
              </span>
            )}
          </div>
          {/* Drag handle */}
          <div
            style={{ pointerEvents: "auto", cursor: "grab" }}
            className="absolute -top-5 -right-0.5 flex items-center justify-center rounded bg-blue-500 p-0.5 text-white shadow-sm hover:bg-blue-600"
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDragStart?.(e);
            }}
          >
            <GripVertical size={12} />
          </div>
        </>
      )}
    </div>
  );
}

interface SelectionOverlayProps {
  selectedElement: EditorElement | null;
  hoveredElement: EditorElement | null;
  onDragStart?: (e: React.MouseEvent) => void;
  dropIndicator?: { y: number; width: number; left: number } | null;
}

export function SelectionOverlay({
  selectedElement,
  hoveredElement,
  onDragStart,
  dropIndicator,
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
        <OverlayBox
          element={selectedElement}
          type="selection"
          onDragStart={onDragStart}
        />
      )}
      {/* Drop indicator line */}
      {dropIndicator && (
        <div
          style={{
            position: "absolute",
            top: `${dropIndicator.y - 1}px`,
            left: `${dropIndicator.left}px`,
            width: `${dropIndicator.width}px`,
            height: "2px",
            background: "rgb(59, 130, 246)",
            zIndex: 20,
            borderRadius: "1px",
            boxShadow: "0 0 4px rgba(59, 130, 246, 0.5)",
            transition: "top 0.1s ease-out",
          }}
        >
          {/* Circle indicators at ends */}
          <div
            style={{
              position: "absolute",
              top: "-3px",
              left: "-4px",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "rgb(59, 130, 246)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "-3px",
              right: "-4px",
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: "rgb(59, 130, 246)",
            }}
          />
        </div>
      )}
    </div>
  );
}
