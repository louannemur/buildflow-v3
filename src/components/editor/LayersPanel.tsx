"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useEditorStore } from "@/lib/editor/store";
import type { EditorElement } from "@/lib/editor/store";

interface LayersPanelProps {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}

const TAG_ICONS: Record<string, string> = {
  div: "\u25A2", section: "\u25A3", main: "\u25C8", header: "\u2630", footer: "\u25AC", nav: "\u2630", aside: "\u25A6", article: "\u25A4",
  h1: "H1", h2: "H2", h3: "H3", h4: "H4", h5: "H5", h6: "H6",
  p: "\u00B6", span: "\u3008\u3009", a: "\uD83D\uDD17", button: "\u25A2", img: "\uD83D\uDDBC", ul: "\u2022", ol: "1.", li: "\u00B7",
  form: "\uD83D\uDCDD", input: "\u25AD", textarea: "\u25AD", select: "\u25BE", label: "L", table: "\u228A", svg: "\u25C7",
};

export function LayersPanel({ iframeRef }: LayersPanelProps) {
  const { elementTree, selectedBfId, hoveredBfId, setSelectedBfId, setHoveredBfId } = useEditorStore();
  const [searchQuery, setSearchQuery] = React.useState("");

  const matchesSearch = React.useCallback((el: EditorElement): boolean => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return el.tag.toLowerCase().includes(q) || el.classes.toLowerCase().includes(q) || el.textContent.toLowerCase().includes(q) || el.bfId.toLowerCase().includes(q);
  }, [searchQuery]);

  const rootElements = React.useMemo(() => elementTree.filter((el) => !el.parentBfId), [elementTree]);

  const handleSelect = React.useCallback((bfId: string) => {
    setSelectedBfId(bfId);
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: "SCROLL_TO", bfId }, "*");
    }
  }, [setSelectedBfId, iframeRef]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-xs font-semibold">Layers</h3>
        <span className="text-[10px] text-muted-foreground">{elementTree.length}</span>
      </div>

      {elementTree.length > 0 && (
        <div className="relative px-2 py-1.5">
          <Search className="absolute left-4 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search elements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border border-border/60 bg-muted/30 py-1 pl-7 pr-2 text-[11px] placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none"
          />
          {searchQuery && (
            <button className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearchQuery("")}>
              &times;
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {elementTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs font-medium text-muted-foreground">No elements</p>
            <span className="text-[10px] text-muted-foreground/60">Generate a design to see layers</span>
          </div>
        ) : searchQuery ? (
          elementTree.filter(matchesSearch).map((el) => (
            <LayerNode key={el.bfId} element={el} allElements={elementTree} selectedBfId={selectedBfId} hoveredBfId={hoveredBfId} onSelect={handleSelect} onHover={setHoveredBfId} depth={0} isSearchResult />
          ))
        ) : (
          rootElements.map((el) => (
            <LayerNode key={el.bfId} element={el} allElements={elementTree} selectedBfId={selectedBfId} hoveredBfId={hoveredBfId} onSelect={handleSelect} onHover={setHoveredBfId} depth={0} isSearchResult={false} />
          ))
        )}
      </div>
    </div>
  );
}

// Layer node (recursive)
interface LayerNodeProps {
  element: EditorElement;
  allElements: EditorElement[];
  selectedBfId: string | null;
  hoveredBfId: string | null;
  onSelect: (bfId: string) => void;
  onHover: (bfId: string | null) => void;
  depth: number;
  forceExpanded?: boolean;
  isSearchResult?: boolean;
}

function LayerNode({ element, allElements, selectedBfId, hoveredBfId, onSelect, onHover, depth, forceExpanded, isSearchResult }: LayerNodeProps) {
  const [expanded, setExpanded] = React.useState(forceExpanded !== undefined ? forceExpanded : depth < 2);
  const isSelected = selectedBfId === element.bfId;
  const isHovered = hoveredBfId === element.bfId;
  const children = allElements.filter((el) => el.parentBfId === element.bfId);
  const hasChildren = children.length > 0;

  // Auto-expand to show selected element
  React.useEffect(() => {
    if (selectedBfId && !isSearchResult) {
      const isAncestor = (bfId: string): boolean => {
        const child = allElements.find((el) => el.bfId === bfId);
        if (!child || !child.parentBfId) return false;
        if (child.parentBfId === element.bfId) return true;
        return isAncestor(child.parentBfId);
      };
      if (isAncestor(selectedBfId)) setExpanded(true);
    }
  }, [selectedBfId, element.bfId, allElements, isSearchResult]);

  const icon = TAG_ICONS[element.tag.toLowerCase()] || "\u25A2";
  const displayText = element.textContent
    ? element.textContent.length > 20 ? element.textContent.slice(0, 20) + "..." : element.textContent
    : null;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-0.5 pr-2 cursor-pointer transition-colors text-[11px] ${
          isSelected ? "bg-primary/10 text-primary" : isHovered ? "bg-muted" : "hover:bg-muted/50"
        }`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={(e) => { e.stopPropagation(); onSelect(element.bfId); }}
        onMouseEnter={() => onHover(element.bfId)}
        onMouseLeave={() => onHover(null)}
      >
        {hasChildren && !isSearchResult ? (
          <button className="shrink-0" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        ) : (
          <span className="w-[10px] shrink-0" />
        )}

        <span className="shrink-0 w-5 text-center text-muted-foreground">{icon}</span>
        <span className="font-medium">{element.tag}</span>

        {displayText ? (
          <span className="truncate text-muted-foreground ml-1" title={element.textContent}>{displayText}</span>
        ) : element.classes ? (
          <span className="truncate text-muted-foreground/60 ml-1" title={element.classes}>.{element.classes.split(" ").slice(0, 2).join(".")}</span>
        ) : null}
      </div>

      {expanded && hasChildren && !isSearchResult && children.map((child) => (
        <LayerNode key={child.bfId} element={child} allElements={allElements} selectedBfId={selectedBfId} hoveredBfId={hoveredBfId} onSelect={onSelect} onHover={onHover} depth={depth + 1} isSearchResult={false} />
      ))}
    </div>
  );
}
