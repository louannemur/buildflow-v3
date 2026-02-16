"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Send, Loader2, Trash2, X } from "lucide-react";
import { useEditorStore } from "@/lib/editor/store";
import { useChatHistoryStore } from "@/stores/chat-history-store";
import { ChatAvatar } from "@/components/features/chat-avatar";
import type { ReferenceOption } from "@/lib/design/reference-resolver";
import {
  REFERENCE_TYPE_LABELS,
  REFERENCE_TYPE_ORDER,
} from "@/lib/design/reference-resolver";
import type { ProjectContext } from "./DesignEditor";

/* ─── Props ───────────────────────────────────────────────────────────────── */

interface EditorChatPanelProps {
  designId: string;
  onEditDesign: (prompt: string) => void;
  onElementEdit: (bfId: string, prompt: string) => void;
  onAddSection: (afterBfId: string, prompt: string) => void;
  isGenerating: boolean;
  projectContext?: ProjectContext | null;
}

/* ─── Constants ───────────────────────────────────────────────────────────── */

const AT_TRIGGER_RE = /@(\S*)$/;

const ADD_SECTION_KEYWORDS = [
  "add section",
  "add a section",
  "insert section",
  "new section after",
];

const EDIT_TYPE_LABELS: Record<string, string> = {
  "full-page": "Page edit",
  element: "Element edit",
  "add-section": "Section added",
  general: "Edit",
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export function EditorChatPanel({
  designId,
  onEditDesign,
  onElementEdit,
  onAddSection,
  isGenerating,
  projectContext,
}: EditorChatPanelProps) {
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const selectedBfId = useEditorStore((s) => s.selectedBfId);
  const setSelectedBfId = useEditorStore((s) => s.setSelectedBfId);
  const elementTree = useEditorStore((s) => s.elementTree);
  const setShowChat = useEditorStore((s) => s.setShowChat);
  const deleteElement = useEditorStore((s) => s.deleteElement);

  // Chat history
  const { conversations, clearHistory, addMessage } = useChatHistoryStore();
  const messages = conversations[designId] || [];
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Input state
  const [editInput, setEditInput] = React.useState("");
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // @ mention state
  const [showMentionMenu, setShowMentionMenu] = React.useState(false);
  const [mentionQuery, setMentionQuery] = React.useState("");
  const [mentionIndex, setMentionIndex] = React.useState(0);
  const [mentionTriggerPos, setMentionTriggerPos] = React.useState(-1);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Auto-focus input on mount
  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on Escape
  React.useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && !showMentionMenu) {
        setShowChat(false);
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [setShowChat, showMentionMenu]);

  // ─── Reference options (@ mentions) ────────────────────────────

  const referenceOptions = React.useMemo<ReferenceOption[]>(() => {
    if (!projectContext) return [];
    const opts: ReferenceOption[] = [];
    projectContext.pages?.forEach((p) => {
      opts.push({ type: "page", label: p.title, value: `@page:${p.title}` });
    });
    projectContext.features?.forEach((f) => {
      opts.push({
        type: "feature",
        label: f.title,
        value: `@feature:${f.title}`,
      });
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
    const groups: Array<{
      type: string;
      label: string;
      items: ReferenceOption[];
    }> = [];
    for (const typeKey of REFERENCE_TYPE_ORDER) {
      const items = filteredOptions.filter((o) => o.type === typeKey);
      if (items.length > 0) {
        groups.push({
          type: typeKey,
          label: REFERENCE_TYPE_LABELS[typeKey],
          items,
        });
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

  // ─── Input handlers ────────────────────────────────────────────

  const handleInputChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
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

  const insertMention = React.useCallback(
    (option: ReferenceOption) => {
      if (mentionTriggerPos < 0) return;
      const cursorPos =
        inputRef.current?.selectionStart || editInput.length;
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

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (showMentionMenu && flatOptions.length > 0) {
        switch (e.key) {
          case "ArrowDown":
            e.preventDefault();
            setMentionIndex((prev) => (prev + 1) % flatOptions.length);
            return;
          case "ArrowUp":
            e.preventDefault();
            setMentionIndex(
              (prev) => (prev - 1 + flatOptions.length) % flatOptions.length,
            );
            return;
          case "Tab":
            e.preventDefault();
            insertMention(flatOptions[mentionIndex]);
            return;
          case "Escape":
            e.preventDefault();
            setShowMentionMenu(false);
            return;
        }
      }

      // Enter to submit (Shift+Enter for newline)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (showMentionMenu && flatOptions.length > 0) {
          insertMention(flatOptions[mentionIndex]);
        } else {
          handleSubmit();
        }
      }
    },
    [showMentionMenu, flatOptions, mentionIndex, insertMention],
  );

  // ─── Dispatch & submit ─────────────────────────────────────────

  const dispatchEdit = React.useCallback(
    (request: string, action: string) => {
      if (action === "element-edit" && selectedBfId) {
        onElementEdit(selectedBfId, request);
      } else if (action === "add-section") {
        const afterBfId = selectedBfId || elementTree.at(-1)?.bfId;
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

  const handleSuggestionClick = React.useCallback(
    (label: string, action: string) => {
      if (action === "remove") {
        if (selectedBfId) {
          deleteElement(selectedBfId);
          addMessage(designId, { role: "user", content: label });
          addMessage(designId, {
            role: "assistant",
            content: "Element removed from the design",
          });
        }
        return;
      }
      // Show user message immediately in chat
      addMessage(designId, {
        role: "user",
        content: label,
        editType:
          action === "add-section"
            ? "add-section"
            : action === "element-edit"
              ? "element"
              : "full-page",
      });
      dispatchEdit(label, action);
    },
    [dispatchEdit, selectedBfId, deleteElement, addMessage, designId],
  );

  const handleSubmit = React.useCallback(() => {
    if (showMentionMenu) {
      setShowMentionMenu(false);
      return;
    }
    const request = editInput.trim();
    if (!request) return;

    const isAddSection = ADD_SECTION_KEYWORDS.some((kw) =>
      request.toLowerCase().includes(kw),
    );
    const action = selectedElement
      ? isAddSection
        ? "add-section"
        : "element-edit"
      : "page-edit";

    // Show user message immediately in chat
    addMessage(designId, {
      role: "user",
      content: request,
      editType:
        action === "add-section"
          ? "add-section"
          : action === "element-edit"
            ? "element"
            : "full-page",
    });

    dispatchEdit(request, action);
    setEditInput("");
  }, [editInput, selectedElement, dispatchEdit, showMentionMenu, addMessage, designId]);

  // ─── Helpers ───────────────────────────────────────────────────

  const formatTime = (timestamp: string) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  let flatIdx = 0;

  // ─── Render ────────────────────────────────────────────────────

  return (
    <motion.div
      initial={{ x: -380 }}
      animate={{ x: 0 }}
      exit={{ x: -380 }}
      transition={{ type: "spring", stiffness: 400, damping: 35 }}
      className="fixed left-0 top-0 bottom-0 z-50 flex w-[380px] flex-col border-r border-border/60 bg-background shadow-xl"
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
        <ChatAvatar state={isGenerating ? "active" : "idle"} size="sm" />
        <div className="flex-1">
          <h3 className="text-sm font-semibold">AI Editor</h3>
          <p className="text-[10px] text-muted-foreground">
            {isGenerating ? "Editing..." : "Describe changes to your design"}
          </p>
        </div>
        <button
          onClick={() => setShowChat(false)}
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <ChatAvatar state="idle" size="default" className="mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              No edits yet
            </p>
            <p className="mt-1 max-w-[240px] text-[11px] text-muted-foreground/60">
              Select an element and describe what to change, or edit the full
              page
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}
            >
              <div
                className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.content}
              </div>
              <div
                className={`mt-0.5 flex items-center gap-1.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && msg.editType && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {EDIT_TYPE_LABELS[msg.editType] || msg.editType}
                  </span>
                )}
                <span className="text-[9px] text-muted-foreground/60">
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Clear history */}
      {messages.length > 0 && (
        <div className="flex justify-end border-t border-border/40 px-4 py-1.5">
          <button
            className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => clearHistory(designId)}
          >
            <Trash2 className="size-3" />
            Clear history
          </button>
        </div>
      )}

      {/* Bottom: context + suggestions + input */}
      <div className="border-t border-border/60 px-3 py-2.5">
        {/* Element context chip */}
        {selectedElement && (
          <div className="mb-2 flex items-center gap-2">
            <button
              className="flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/20"
              onClick={() => setSelectedBfId(null)}
              title="Click to deselect and edit full page"
            >
              <span>&lt;{selectedElement.tag}&gt;</span>
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
                  : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
              onClick={() => handleSuggestionClick(s.label, s.action)}
              disabled={isGenerating}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Input */}
        <div className="relative">
          <div className="flex items-end gap-2">
            <div className="relative flex-1">
              <textarea
                ref={inputRef}
                className="w-full resize-none rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                placeholder={
                  selectedElement
                    ? `Edit <${selectedElement.tag}>... (type @ to reference)`
                    : "Describe what to change... (type @ to reference)"
                }
                rows={2}
                value={editInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isGenerating}
              />

              {/* @ Mention dropdown */}
              {showMentionMenu && flatOptions.length > 0 && (
                <div
                  ref={menuRef}
                  className="absolute bottom-full left-0 mb-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border/60 bg-background shadow-lg"
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
              type="button"
              onClick={handleSubmit}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors disabled:opacity-50"
              disabled={isGenerating || !editInput.trim()}
            >
              {isGenerating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
