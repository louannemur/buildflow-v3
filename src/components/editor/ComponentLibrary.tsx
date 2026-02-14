"use client";

import * as React from "react";
import { Search, X, Check } from "lucide-react";
import {
  COMPONENT_SECTIONS,
  CATEGORIES_ORDER,
  CATEGORY_LABELS,
  CATEGORY_ICONS,
  searchSections,
  type ComponentCategory,
} from "@/lib/design/component-library";

interface ComponentLibraryProps {
  selectedIds: string[];
  onToggleSection: (id: string) => void;
  onAddSelected: () => void;
  onClose: () => void;
}

export function ComponentLibrary({
  selectedIds,
  onToggleSection,
  onAddSelected,
  onClose,
}: ComponentLibraryProps) {
  const [search, setSearch] = React.useState("");
  const [activeCategory, setActiveCategory] = React.useState<ComponentCategory | "all">("all");

  const filtered = React.useMemo(() => {
    let sections = search ? searchSections(search) : COMPONENT_SECTIONS;
    if (activeCategory !== "all") {
      sections = sections.filter((s) => s.category === activeCategory);
    }
    return sections;
  }, [search, activeCategory]);

  const grouped = React.useMemo(() => {
    const map = new Map<ComponentCategory, typeof filtered>();
    for (const section of filtered) {
      const list = map.get(section.category) || [];
      list.push(section);
      map.set(section.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex h-full w-64 flex-col border-r border-border/60 bg-background">
      {/* Header */}
      <div className="border-b border-border/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-semibold">Components</h3>
          <button onClick={onClose} className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors">
            <X className="size-3.5" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border/60 bg-muted/30 py-1.5 pl-7 pr-2 text-xs placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none"
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          <button
            className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
              activeCategory === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveCategory("all")}
          >
            All
          </button>
          {CATEGORIES_ORDER.map((cat) => (
            <button
              key={cat}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                activeCategory === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setActiveCategory(cat)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Section list */}
      <div className="flex-1 overflow-y-auto p-2">
        {CATEGORIES_ORDER.map((cat) => {
          const sections = grouped.get(cat);
          if (!sections || sections.length === 0) return null;

          return (
            <div key={cat} className="mb-3">
              <div className="mb-1.5 flex items-center gap-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>{CATEGORY_ICONS[cat]}</span>
                {CATEGORY_LABELS[cat]}
              </div>
              <div className="space-y-1">
                {sections.map((section) => {
                  const isSelected = selectedIds.includes(section.id);
                  return (
                    <button
                      key={section.id}
                      className={`flex w-full items-center gap-2 rounded-md p-2 text-left transition-all ${
                        isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-muted border border-transparent"
                      }`}
                      onClick={() => onToggleSection(section.id)}
                    >
                      <span className="text-base shrink-0">{section.thumbnail}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">{section.name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{section.description}</div>
                      </div>
                      {isSelected && (
                        <div className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary">
                          <Check className="size-2.5 text-primary-foreground" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="py-8 text-center text-xs text-muted-foreground">No components match your search</p>
        )}
      </div>

      {/* Footer */}
      {selectedIds.length > 0 && (
        <div className="border-t border-border/60 p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
          <button
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            onClick={onAddSelected}
          >
            Add to page
          </button>
        </div>
      )}
    </div>
  );
}
