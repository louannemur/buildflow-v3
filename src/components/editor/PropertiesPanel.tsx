"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useEditorStore } from "@/lib/editor/store";
import {
  addClassToElement,
  removeClassFromElement,
  updateElementText,
  updateElementAttribute,
} from "@/lib/design/code-mutator";
import { injectBfIds, stripBfIds } from "@/lib/design/inject-bf-ids";

interface PropertiesPanelProps {
  designCode: string;
  onCodeChange: (newCode: string) => void;
}

// Simple Tailwind class categorization
function categorizeClasses(classStr: string): Record<string, string[]> {
  const classes = classStr.split(/\s+/).filter(Boolean);
  const categories: Record<string, string[]> = {
    layout: [],
    spacing: [],
    sizing: [],
    typography: [],
    colors: [],
    borders: [],
    effects: [],
    other: [],
  };

  for (const cls of classes) {
    if (/^(flex|grid|block|inline|hidden|relative|absolute|fixed|sticky|float|clear|overflow|z-)/.test(cls) || /^(items-|justify-|gap-|order-|col-|row-)/.test(cls)) {
      categories.layout.push(cls);
    } else if (/^(p[xytblr]?-|m[xytblr]?-|space-)/.test(cls)) {
      categories.spacing.push(cls);
    } else if (/^(w-|h-|min-|max-|size-)/.test(cls)) {
      categories.sizing.push(cls);
    } else if (/^(text-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl)|font-|leading-|tracking-|whitespace-|break-|truncate|uppercase|lowercase|capitalize|italic|not-italic|underline|overline|line-through|no-underline|antialiased)/.test(cls)) {
      categories.typography.push(cls);
    } else if (/^(bg-|text-(?!xs|sm|base|lg|xl)|from-|via-|to-|decoration-|accent-|caret-|fill-|stroke-|placeholder-)/.test(cls)) {
      categories.colors.push(cls);
    } else if (/^(border|rounded|ring|outline|divide|shadow)/.test(cls)) {
      categories.borders.push(cls);
    } else if (/^(opacity-|backdrop-|blur|brightness|contrast|drop-shadow|grayscale|hue-rotate|invert|saturate|sepia|transition|duration|ease|delay|animate|scale|rotate|translate|skew|transform|cursor|pointer-events|select|resize|scroll|snap|touch|will-change)/.test(cls)) {
      categories.effects.push(cls);
    } else {
      categories.other.push(cls);
    }
  }

  return categories;
}

const CATEGORY_LABELS: Record<string, string> = {
  layout: "Layout",
  spacing: "Spacing",
  sizing: "Sizing",
  typography: "Typography",
  colors: "Colors",
  borders: "Borders & Shadows",
  effects: "Effects & Transitions",
  other: "Other",
};

export function PropertiesPanel({ designCode, onCodeChange }: PropertiesPanelProps) {
  const { selectedElement, selectedBfId, setSelectedBfId, toggleProperties } = useEditorStore();

  const [addClassCategory, setAddClassCategory] = React.useState<string | null>(null);
  const [addClassValue, setAddClassValue] = React.useState("");
  const [editingText, setEditingText] = React.useState(false);
  const [textValue, setTextValue] = React.useState("");
  const [editingAlt, setEditingAlt] = React.useState(false);
  const [altValue, setAltValue] = React.useState("");
  const addClassInputRef = React.useRef<HTMLInputElement>(null);

  const selectedClasses = selectedElement?.classes;
  const categorized = React.useMemo(() => {
    if (!selectedClasses) return null;
    return categorizeClasses(selectedClasses);
  }, [selectedClasses]);

  React.useEffect(() => {
    setEditingText(false);
    setAddClassCategory(null);
    if (selectedElement?.textContent) setTextValue(selectedElement.textContent);
    setEditingAlt(false);
    if (selectedElement?.attributes?.alt) setAltValue(selectedElement.attributes.alt);
  }, [selectedBfId, selectedElement?.textContent, selectedElement?.attributes?.alt]);

  React.useEffect(() => {
    if (addClassCategory && addClassInputRef.current) addClassInputRef.current.focus();
  }, [addClassCategory]);

  if (!selectedElement) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border/60 px-3 py-2">
          <h3 className="text-xs font-semibold">Properties</h3>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted-foreground">Select an element to edit</p>
        </div>
      </div>
    );
  }

  // Mutate code through inject -> mutate -> strip pipeline
  const mutateAndSave = (mutator: (annotated: string) => string) => {
    const { annotatedCode } = injectBfIds(designCode);
    const updated = mutator(annotatedCode);
    const clean = stripBfIds(updated);
    if (clean !== designCode) onCodeChange(clean);
  };

  const handleRemoveClass = (cls: string) => {
    if (!selectedBfId) return;
    mutateAndSave((code) => removeClassFromElement(code, selectedBfId, cls));
  };

  const handleAddClass = () => {
    if (!selectedBfId || !addClassValue.trim()) return;
    const classesToAdd = addClassValue.trim().split(/\s+/);
    mutateAndSave((code) => {
      let result = code;
      for (const cls of classesToAdd) result = addClassToElement(result, selectedBfId, cls);
      return result;
    });
    setAddClassValue("");
    setAddClassCategory(null);
  };

  const handleTextChange = () => {
    if (!selectedBfId || textValue === selectedElement.textContent) { setEditingText(false); return; }
    mutateAndSave((code) => updateElementText(code, selectedBfId, textValue));
    setEditingText(false);
  };

  const handleAltChange = () => {
    if (!selectedBfId) { setEditingAlt(false); return; }
    const currentAlt = selectedElement.attributes?.alt || "";
    if (altValue === currentAlt) { setEditingAlt(false); return; }
    mutateAndSave((code) => updateElementAttribute(code, selectedBfId, "alt", altValue));
    setEditingAlt(false);
  };

  const categories = categorized ? Object.keys(categorized).filter((cat) => categorized[cat].length > 0) : [];
  const emptyCategories = categorized ? Object.keys(categorized).filter((cat) => categorized[cat].length === 0 && cat !== "other") : [];
  const isImageElement = selectedElement.tag === "img";
  const currentAlt = selectedElement.attributes?.alt || "";

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <h3 className="text-xs font-semibold">Properties</h3>
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{selectedElement.tag}</span>
          <button
            onClick={() => { setSelectedBfId(null); toggleProperties(); }}
            className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Element info */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Element</label>
          <div className="text-xs text-foreground">&lt;{selectedElement.tag}&gt;</div>
        </div>

        {/* Image section */}
        {isImageElement && (
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Alt Text</label>
            {editingAlt ? (
              <input
                type="text"
                className="w-full rounded border border-border/60 bg-muted/30 px-2 py-1 text-xs focus:border-primary/40 focus:outline-none"
                value={altValue}
                onChange={(e) => setAltValue(e.target.value)}
                onBlur={handleAltChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleAltChange(); }
                  if (e.key === "Escape") { setAltValue(currentAlt); setEditingAlt(false); }
                }}
                autoFocus
              />
            ) : (
              <div className="cursor-pointer rounded bg-muted/30 px-2 py-1 text-xs hover:bg-muted transition-colors" onClick={() => { setAltValue(currentAlt); setEditingAlt(true); }}>
                {currentAlt || "(no alt text)"}
              </div>
            )}
          </div>
        )}

        {/* Text content */}
        {selectedElement.textContent && (
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Text Content</label>
            {editingText ? (
              <textarea
                className="w-full rounded border border-border/60 bg-muted/30 px-2 py-1 text-xs focus:border-primary/40 focus:outline-none resize-none"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                onBlur={handleTextChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTextChange(); }
                  if (e.key === "Escape") { setTextValue(selectedElement.textContent); setEditingText(false); }
                }}
                rows={3}
                autoFocus
              />
            ) : (
              <div className="cursor-pointer rounded bg-muted/30 px-2 py-1 text-xs hover:bg-muted transition-colors" onClick={() => { setTextValue(selectedElement.textContent); setEditingText(true); }}>
                {selectedElement.textContent}
              </div>
            )}
          </div>
        )}

        {/* Class categories */}
        {categories.map((category) => (
          <div key={category}>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[category]}</label>
            <div className="flex flex-wrap gap-1">
              {categorized![category].map((cls) => (
                <span key={cls} className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px]">
                  <span>{cls}</span>
                  <button className="ml-0.5 text-muted-foreground hover:text-foreground" onClick={() => handleRemoveClass(cls)}>&times;</button>
                </span>
              ))}
              {addClassCategory === category ? (
                <form onSubmit={(e) => { e.preventDefault(); handleAddClass(); }} className="inline-flex">
                  <input
                    ref={addClassInputRef}
                    type="text"
                    className="w-24 rounded border border-primary/40 bg-transparent px-1.5 py-0.5 text-[10px] focus:outline-none"
                    placeholder="e.g. flex-col"
                    value={addClassValue}
                    onChange={(e) => setAddClassValue(e.target.value)}
                    onBlur={() => { if (!addClassValue.trim()) setAddClassCategory(null); }}
                    onKeyDown={(e) => { if (e.key === "Escape") { setAddClassCategory(null); setAddClassValue(""); } }}
                  />
                </form>
              ) : (
                <button className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setAddClassCategory(category); setAddClassValue(""); }}>+</button>
              )}
            </div>
          </div>
        ))}

        {/* Empty categories */}
        {emptyCategories.length > 0 && (
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Add Classes</label>
            <div className="flex flex-wrap gap-1">
              {emptyCategories.map((cat) => (
                <button key={cat} className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setAddClassCategory(cat); setAddClassValue(""); }}>
                  + {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
            {addClassCategory && emptyCategories.includes(addClassCategory) && (
              <form onSubmit={(e) => { e.preventDefault(); handleAddClass(); }} className="mt-1.5">
                <input
                  ref={addClassInputRef}
                  type="text"
                  className="w-full rounded border border-primary/40 bg-transparent px-2 py-1 text-[10px] focus:outline-none"
                  placeholder={`Add ${CATEGORY_LABELS[addClassCategory].toLowerCase()} class...`}
                  value={addClassValue}
                  onChange={(e) => setAddClassValue(e.target.value)}
                  onBlur={() => { if (!addClassValue.trim()) setAddClassCategory(null); }}
                  onKeyDown={(e) => { if (e.key === "Escape") { setAddClassCategory(null); setAddClassValue(""); } }}
                />
              </form>
            )}
          </div>
        )}

        {/* bf-id */}
        <div>
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">ID</label>
          <div className="text-[10px] font-mono text-muted-foreground">{selectedElement.bfId}</div>
        </div>
      </div>
    </div>
  );
}
