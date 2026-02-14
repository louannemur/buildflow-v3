"use client";

import * as React from "react";
import { Send, Loader2, MessageCircle } from "lucide-react";
import { useEditorStore } from "@/lib/editor/store";
import type { ReferenceOption } from "@/lib/design/reference-resolver";
import { REFERENCE_TYPE_LABELS, REFERENCE_TYPE_ORDER } from "@/lib/design/reference-resolver";
import type { ProjectContext } from "./DesignEditor";

interface PromptBarProps {
  onEditDesign: (prompt: string) => void;
  onElementEdit: (bfId: string, prompt: string) => void;
  onAddSection: (afterBfId: string, prompt: string) => void;
  isGenerating: boolean;
  projectContext?: ProjectContext | null;
}

const AT_TRIGGER_RE = /@(\S*)$/;

const ADD_SECTION_KEYWORDS = [
  "add section",
  "add a section",
  "insert section",
  "new section after",
];

export function PromptBar({
  onEditDesign,
  onElementEdit,
  onAddSection,
  isGenerating,
  projectContext,
}: PromptBarProps) {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const selectedBfId = useEditorStore((s) => s.selectedBfId);
  const setSelectedBfId = useEditorStore((s) => s.setSelectedBfId);
  const elementTree = useEditorStore((s) => s.elementTree);
  const showChat = useEditorStore((s) => s.showChat);
  const toggleChat = useEditorStore((s) => s.toggleChat);
  const deleteElement = useEditorStore((s) => s.deleteElement);

  const [editInput, setEditInput] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // @ mention state
  const [showMentionMenu, setShowMentionMenu] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState("");
  const [mentionIndex, setMentionIndex] = React.useState(0);
  const [mentionTriggerPos, setMentionTriggerPos] = React.useState(-1);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Build reference options from project context
  const referenceOptions = React.useMemo<ReferenceOption[]>(() => {
    if (!projectContext) return [];
    const opts: ReferenceOption[] = [];
    projectContext.pages?.forEach((p) => {
      opts.push({ type: "page", label: p.title, value: `@page:${p.title}` });
    });
    projectContext.features?.forEach((f) => {
      opts.push({ type: "feature", label: f.title, value: `@feature:${f.title}` });
    });
    projectContext.flows?.forEach((f) => {
      opts.push({ type: "flow", label: f.title, value: `@flow:${f.title}` });
    });
    return opts;
  }, [projectContext]);

  // Context-aware suggestions
  const suggestions = React.useMemo(() => {
    if (selectedElement) {
      return [
        { label: "Change color", action: "element-edit" as const },
        { label: "Change size", action: "element-edit" as const },
        { label: "Add section after", action: "add-section" as const },
        { label: "Remove element", action: "remove" as const },
      ];
    }
    return [
      { label: "Change the color scheme", action: "page-edit" as const },
      { label: "Add more spacing", action: "page-edit" as const },
      { label: "Change the font", action: "page-edit" as const },
      { label: "Add a new section", action: "page-edit" as const },
    ];
  }, [selectedElement]);

  // Filtered mention options
  const filteredOptions = React.useMemo(() => {
    if (!showMentionMenu) return [];
    const q = mentionQuery.toLowerCase();
    return referenceOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.type.includes(q) ||
        opt.value.toLowerCase().includes(q),
    );
  }, [showMentionMenu, mentionQuery, referenceOptions]);

  // Group by type
  const groupedOptions = React.useMemo(() => {
    const groups: Array<{ type: string; label: string; items: ReferenceOption[] }> = [];
    for (const typeKey of REFERENCE_TYPE_ORDER) {
      const items = filteredOptions.filter((o) => o.type === typeKey);
      if (items.length > 0) {
        groups.push({ type: typeKey, label: REFERENCE_TYPE_LABELS[typeKey], items });
      }
    }
    return groups;
  }, [filteredOptions]);

  const flatOptions = React.useMemo(
    () => groupedOptions.flatMap((g) => g.items),
    [groupedOptions],
  );

  React.useEffect(() => {
    setMentionIndex(0);
  }, [flatOptions.length]);

  React.useEffect(() => {
    if (!showMentionMenu || !menuRef.current) return;
    const active = menuRef.current.querySelector(
      `[data-mention-idx="${mentionIndex}"]`,
    );
    if (active) active.scrollIntoView({ block: "nearest" });
  }, [mentionIndex, showMentionMenu]);

  // Input change - detect @ trigger
  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setEditInput(value);

      const cursorPos = e.target.selectionStart || value.length;
      const textBeforeCursor = value.slice(0, cursorPos);
      const atMatch = textBeforeCursor.match(AT_TRIGGER_RE);

      if (atMatch) {
        setShowMentionMenu(true);
        setMentionQuery(atMatch[1]);
        setMentionTriggerPos(textBeforeCursor.length - atMatch[0].length);
      } else {
        setShowMentionMenu(false);
        setMentionQuery("");
        setMentionTriggerPos(-1);
      }
    },
    [],
  );

  // Insert a mention
  const insertMention = React.useCallback(
    (option: ReferenceOption) => {
      if (mentionTriggerPos < 0) return;
      const cursorPos = inputRef.current?.selectionStart || editInput.length;
      const before = editInput.slice(0, mentionTriggerPos);
      const after = editInput.slice(cursorPos);
      const newValue = before + option.value + " " + after;
      setEditInput(newValue);
      setShowMentionMenu(false);
      setMentionQuery("");
      setMentionTriggerPos(-1);
      requestAnimationFrame(() => {
        if (inputRef.current) {
          const newCursorPos = before.length + option.value.length + 1;
          inputRef.current.focus();
          inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
      });
    },
    [editInput, mentionTriggerPos],
  );

  // Keyboard navigation for mention menu
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!showMentionMenu || flatOptions.length === 0) return;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setMentionIndex((prev) => (prev + 1) % flatOptions.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setMentionIndex(
            (prev) => (prev - 1 + flatOptions.length) % flatOptions.length,
          );
          break;
        case "Enter":
          e.preventDefault();
          insertMention(flatOptions[mentionIndex]);
          break;
        case "Escape":
          e.preventDefault();
          setShowMentionMenu(false);
          break;
        case "Tab":
          e.preventDefault();
          insertMention(flatOptions[mentionIndex]);
          break;
      }
    },
    [showMentionMenu, flatOptions, mentionIndex, insertMention],
  );

  // Dispatch edit
  const dispatchEdit = React.useCallback(
    (request: string, action: string) => {
      if (action === "element-edit" && selectedBfId) {
        onElementEdit(selectedBfId, request);
      } else if (action === "add-section") {
        const afterBfId =
          selectedBfId || elementTree.at(-1)?.bfId;
        if (afterBfId) {
          onAddSection(afterBfId, request);
        } else {
          onEditDesign(request);
        }
      } else {
        onEditDesign(request);
      }
    },
    [selectedBfId, elementTree, onEditDesign, onElementEdit, onAddSection],
  );

  // Suggestion click
  const handleSuggestionClick = React.useCallback(
    (label: string, action: string) => {
      if (action === "remove") {
        if (selectedBfId) deleteElement(selectedBfId);
        return;
      }
      dispatchEdit(label, action);
    },
    [dispatchEdit, selectedBfId, deleteElement],
  );

  // Form submit
  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (showMentionMenu) {
        setShowMentionMenu(false);
        return;
      }
      const request = editInput.trim();
      if (!request) return;

      if (selectedElement) {
        const isAddSection = ADD_SECTION_KEYWORDS.some((kw) =>
          request.toLowerCase().includes(kw),
        );
        dispatchEdit(request, isAddSection ? "add-section" : "element-edit");
      } else {
        dispatchEdit(request, "page-edit");
      }
      setEditInput("");
    },
    [editInput, selectedElement, dispatchEdit, showMentionMenu],
  );

  // Flat index counter for keyboard nav
  let flatIdx = 0;

  return (
    <div className="border-t border-border/60 bg-background px-3 py-2">
      {/* Context chip */}
      {selectedElement && (
        <div className="mb-2 flex items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
            onClick={() => setSelectedBfId(null)}
            title="Click to deselect and edit full page"
          >
            <span>
              &lt;{selectedElement.tag}&gt;
            </span>
            {selectedElement.classes && (
              <span className="opacity-60">
                .{selectedElement.classes.split(" ").slice(0, 2).join(".")}
              </span>
            )}
            <svg
              width="8"
              height="8"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <span className="text-[10px] text-muted-foreground">
            Editing element
          </span>
        </div>
      )}

      {/* Quick suggestions */}
      <div className="mb-2 flex flex-wrap gap-1">
        {suggestions.map((s) => (
          <button
            key={s.label}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              s.action === "remove"
                ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"
            }`}
            onClick={() => handleSuggestionClick(s.label, s.action)}
            disabled={isGenerating}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <form className="flex items-center gap-2" onSubmit={handleSubmit}>
        <button
          type="button"
          className={`shrink-0 rounded-md p-1.5 transition-colors ${
            showChat
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={toggleChat}
          title={showChat ? "Hide edit history" : "Show edit history"}
        >
          <MessageCircle className="size-4" />
        </button>

        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            className="w-full rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
            placeholder={
              selectedElement
                ? `Edit <${selectedElement.tag}>... (type @ to reference)`
                : "Describe what to change... (type @ to reference)"
            }
            value={editInput}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
          />

          {/* @ Mention dropdown */}
          {showMentionMenu && flatOptions.length > 0 && (
            <div
              ref={menuRef}
              className="absolute bottom-full left-0 mb-1 max-h-48 w-72 overflow-y-auto rounded-lg border border-border/60 bg-background shadow-lg"
            >
              {groupedOptions.map((group) => (
                <div key={group.type}>
                  <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </div>
                  {group.items.map((option) => {
                    const idx = flatIdx++;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={`flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors ${
                          idx === mentionIndex
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        }`}
                        data-mention-idx={idx}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          insertMention(option);
                        }}
                        onMouseEnter={() => setMentionIndex(idx)}
                      >
                        <span className="text-[10px] text-muted-foreground">
                          @{option.type}
                        </span>
                        <span>{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}

          {showMentionMenu &&
            flatOptions.length === 0 &&
            mentionQuery.length > 0 && (
              <div className="absolute bottom-full left-0 mb-1 rounded-lg border border-border/60 bg-background px-3 py-2 shadow-lg">
                <span className="text-xs text-muted-foreground">
                  No matches for @{mentionQuery}
                </span>
              </div>
            )}
        </div>

        <button
          type="submit"
          className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground disabled:opacity-50 transition-colors"
          disabled={isGenerating || !editInput.trim()}
        >
          {isGenerating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
        </button>
      </form>
    </div>
  );
}
