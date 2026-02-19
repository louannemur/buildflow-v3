"use client";

import { useState, useEffect, useRef } from "react";
import { ChatAvatar } from "./chat-avatar";

/* ─── Context-specific message sets ──────────────────────────────────────── */

export const DESIGN_THINKING = [
  "Analyzing your design brief...",
  "Configuring colour scheme...",
  "Thinking about layout...",
  "Structuring components...",
  "Applying responsive styles...",
  "Fine-tuning details...",
];

export const FEATURES_THINKING = [
  "Analyzing your project...",
  "Identifying core features...",
  "Defining feature scope...",
  "Prioritizing functionality...",
];

export const FLOWS_THINKING = [
  "Mapping user journeys...",
  "Defining interaction patterns...",
  "Connecting user flows...",
  "Optimizing navigation paths...",
];

export const PAGES_THINKING = [
  "Planning page structure...",
  "Organizing content sections...",
  "Defining page hierarchy...",
  "Mapping navigation flow...",
];

/* ─── Hook: typewriter effect that cycles through messages ─────────────── */

export function useTypewriter(
  messages: string[],
  typingSpeed = 35,
  pauseDuration = 1500,
) {
  const [displayText, setDisplayText] = useState("");
  const msgIndexRef = useRef(0);
  const charIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (messages.length === 0) return;

    msgIndexRef.current = 0;
    charIndexRef.current = 0;

    function typeNext() {
      const msg = messages[msgIndexRef.current];
      if (charIndexRef.current <= msg.length) {
        const text = msg.slice(0, charIndexRef.current);
        charIndexRef.current++;
        setDisplayText(text);
        timerRef.current = setTimeout(typeNext, typingSpeed);
      } else {
        // Finished typing — pause then move to next message
        timerRef.current = setTimeout(() => {
          msgIndexRef.current =
            (msgIndexRef.current + 1) % messages.length;
          charIndexRef.current = 0;
          typeNext();
        }, pauseDuration);
      }
    }

    typeNext();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [messages, typingSpeed, pauseDuration]);

  return displayText;
}

/* ─── Legacy hook (kept for any other consumers) ──────────────────────── */

export function useMessageCycler(messages: string[], interval = 3000) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => {
      setIndex((prev) => (prev + 1) % messages.length);
    }, interval);
    return () => clearInterval(id);
  }, [messages, interval]);

  return messages[index];
}

/* ─── Component ──────────────────────────────────────────────────────────── */

interface ThinkingAnimationProps {
  messages: string[];
  typingSpeed?: number;
  pauseDuration?: number;
  onCancel?: () => void;
}

export function ThinkingAnimation({
  messages,
  typingSpeed = 35,
  pauseDuration = 1500,
  onCancel,
}: ThinkingAnimationProps) {
  const displayText = useTypewriter(messages, typingSpeed, pauseDuration);

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <ChatAvatar state="active" size="default" />

      <div className="mt-5 flex h-6 items-center">
        <span className="text-sm font-medium text-muted-foreground">
          {displayText}
        </span>
        <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-muted-foreground/60" />
      </div>

      {onCancel && (
        <button
          onClick={onCancel}
          className="mt-4 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
