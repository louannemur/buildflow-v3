import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import type { ReferenceOption } from "@/lib/design/reference-resolver";
import {
  REFERENCE_TYPE_LABELS,
  REFERENCE_TYPE_ORDER,
} from "@/lib/design/reference-resolver";

const AT_TRIGGER_RE = /@(\S*)$/;

export interface MentionGroup {
  type: string;
  label: string;
  items: ReferenceOption[];
}

export function useMentionSystem(referenceOptions: ReferenceOption[]) {
  const [editInput, setEditInput] = useState("");
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionTriggerPos, setMentionTriggerPos] = useState(-1);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Filtered mention options
  const filteredOptions = useMemo(() => {
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
  const groupedOptions = useMemo<MentionGroup[]>(() => {
    const groups: MentionGroup[] = [];
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

  const flatOptions = useMemo(
    () => groupedOptions.flatMap((g) => g.items),
    [groupedOptions],
  );

  useEffect(() => {
    if (!showMentionMenu || !menuRef.current) return;
    const active = menuRef.current.querySelector(
      `[data-mention-idx="${mentionIndex}"]`,
    );
    if (active) active.scrollIntoView({ block: "nearest" });
  }, [mentionIndex, showMentionMenu]);

  const handleInputChange = useCallback(
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
        setMentionIndex(0);
      } else {
        setShowMentionMenu(false);
        setMentionQuery("");
        setMentionTriggerPos(-1);
      }
    },
    [],
  );

  const insertMention = useCallback(
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

  const handleMentionKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!showMentionMenu || flatOptions.length === 0) return false;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setMentionIndex((prev) => (prev + 1) % flatOptions.length);
          return true;
        case "ArrowUp":
          e.preventDefault();
          setMentionIndex(
            (prev) => (prev - 1 + flatOptions.length) % flatOptions.length,
          );
          return true;
        case "Tab":
          e.preventDefault();
          insertMention(flatOptions[mentionIndex]);
          return true;
        case "Escape":
          e.preventDefault();
          setShowMentionMenu(false);
          return true;
        case "Enter":
          e.preventDefault();
          insertMention(flatOptions[mentionIndex]);
          return true;
      }
      return false;
    },
    [showMentionMenu, flatOptions, mentionIndex, insertMention],
  );

  return {
    editInput,
    setEditInput,
    showMentionMenu,
    setShowMentionMenu,
    groupedOptions,
    flatOptions,
    mentionIndex,
    setMentionIndex,
    menuRef,
    inputRef,
    handleInputChange,
    handleMentionKeyDown,
    insertMention,
  };
}
