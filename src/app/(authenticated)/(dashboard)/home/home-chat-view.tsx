"use client";

import { type RefObject, useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, ArrowRight } from "lucide-react";
import { NetworkGraph } from "@/components/features/network-graph";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { GlobalChatMessage, GlobalSuggestion } from "@/stores/global-chat-store";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface HomeChatViewProps {
  messages: GlobalChatMessage[];
  chatInput: string;
  setChatInput: (val: string) => void;
  isProcessing: boolean;
  onSubmit: (text?: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  dynamicSuggestions: GlobalSuggestion[];
  onSuggestionClick: (s: GlobalSuggestion) => void;
  user: { name?: string | null; image?: string | null } | undefined;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function FormattedText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/* ─── Typewriter text ───────────────────────────────────────────────────── */

function TypewriterText({
  text,
  onComplete,
}: {
  text: string;
  onComplete?: () => void;
}) {
  const [displayed, setDisplayed] = useState(0);
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; });

  useEffect(() => {
    if (displayed >= text.length) {
      onCompleteRef.current?.();
      return;
    }

    // Faster for longer messages, slower for short ones
    const baseSpeed = text.length > 100 ? 8 : 15;
    const timeout = setTimeout(() => {
      // Type 1-3 chars at a time for natural feel
      const step = text.length > 200 ? 3 : text.length > 80 ? 2 : 1;
      setDisplayed((d) => Math.min(d + step, text.length));
    }, baseSpeed);

    return () => clearTimeout(timeout);
  }, [displayed, text]);

  const visible = text.slice(0, displayed);

  return (
    <>
      <FormattedText text={visible} />
      {displayed < text.length && (
        <span className="ml-0.5 inline-block h-[1.1em] w-[2px] animate-pulse bg-foreground/60 align-text-bottom" />
      )}
    </>
  );
}

/* ─── User message bubble ────────────────────────────────────────────────── */

function UserMessage({
  content,
  user,
}: {
  content: string;
  user: HomeChatViewProps["user"];
}) {
  return (
    <div className="flex items-start justify-end gap-3">
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-foreground px-4 py-3 text-left text-sm text-background sm:max-w-[70%]">
        {content}
      </div>
      <Avatar className="size-8 shrink-0">
        <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? ""} />
        <AvatarFallback className="text-xs">
          {getInitials(user?.name)}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

/* ─── Assistant message ──────────────────────────────────────────────────── */

function AssistantMessage({
  message,
  animate,
  onAnimationComplete,
}: {
  message: GlobalChatMessage;
  animate: boolean;
  onAnimationComplete?: () => void;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="size-8 shrink-0">
        <NetworkGraph />
      </div>
      <div className="max-w-[90%] pt-[5px] sm:max-w-[80%]">
        <div className="text-sm leading-relaxed text-foreground">
          {animate ? (
            <TypewriterText
              text={message.content}
              onComplete={onAnimationComplete}
            />
          ) : (
            <FormattedText text={message.content} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Waiting indicator (just the avatar, no bubble) ────────────────────── */

function WaitingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex items-start gap-3"
    >
      <div className="size-8 shrink-0">
        <NetworkGraph isTalking />
      </div>
      <div className="flex items-center pt-[5px]">
        <span className="inline-block h-[1.1em] w-[2px] animate-pulse bg-foreground/40" />
      </div>
    </motion.div>
  );
}

/* ─── Main chat view ─────────────────────────────────────────────────────── */

export function HomeChatView({
  messages,
  chatInput,
  setChatInput,
  isProcessing,
  onSubmit,
  onKeyDown,
  dynamicSuggestions,
  onSuggestionClick,
  user,
  messagesEndRef,
  textareaRef,
}: HomeChatViewProps) {
  // Track which messages have already been animated.
  // Initialize with all current message IDs so history messages don't animate.
  const [animatedIds, setAnimatedIds] = useState(
    () => new Set(messages.map((m) => m.id)),
  );

  const markAnimated = useCallback((id: string) => {
    setAnimatedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  // Separate action buttons from regular suggestion chips
  const actionSuggestions = dynamicSuggestions.filter(
    (s) => s.action === "create_project" || s.action === "create_design" || s.action === "go_to_project",
  );
  const messageSuggestions = dynamicSuggestions.filter(
    (s) => s.action === "send_message",
  );

  return (
    <div className="flex h-[min(65vh,600px)] flex-col">
      {/* Scrollable messages area — fills available space */}
      <div className="flex-1 overflow-y-auto pr-1" data-chat-scroll>
        <div className="flex min-h-full flex-col justify-end space-y-8 py-4">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const shouldAnimate =
                msg.role === "assistant" && !animatedIds.has(msg.id);

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    ease: [0.25, 0.4, 0, 1] as [number, number, number, number],
                  }}
                >
                  {msg.role === "user" ? (
                    <UserMessage content={msg.content} user={user} />
                  ) : (
                    <AssistantMessage
                      message={msg}
                      animate={shouldAnimate}
                      onAnimationComplete={() => markAnimated(msg.id)}
                    />
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>

          <AnimatePresence>{isProcessing && <WaitingIndicator />}</AnimatePresence>
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pinned bottom: suggestions + action + input */}
      <div className="shrink-0 pt-4">
        {!isProcessing && (messageSuggestions.length > 0 || actionSuggestions.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="mb-3 flex flex-wrap items-center gap-2"
          >
            {/* Regular suggestion chips */}
            {messageSuggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => onSuggestionClick(s)}
                disabled={isProcessing}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground/80 transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
              >
                {s.label}
              </button>
            ))}

            {/* Primary action button */}
            {actionSuggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => onSuggestionClick(s)}
                disabled={isProcessing}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {s.label}
                <ArrowRight className="size-3.5" />
              </button>
            ))}
          </motion.div>
        )}

        {/* Chat input */}
        <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-colors focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20">
          <textarea
            ref={textareaRef}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Describe your vision..."
            disabled={isProcessing}
            rows={1}
            className={cn(
              "w-full resize-none bg-transparent px-4 py-3 pr-12 text-sm",
              "placeholder:text-muted-foreground/60",
              "focus:outline-none",
              "disabled:opacity-60",
              "min-h-[48px] max-h-[120px]",
            )}
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={() => onSubmit()}
            disabled={!chatInput.trim() || isProcessing}
            className={cn(
              "absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-lg transition-colors",
              chatInput.trim() && !isProcessing
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "text-muted-foreground/40",
            )}
          >
            {isProcessing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
