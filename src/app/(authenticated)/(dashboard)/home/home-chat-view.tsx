"use client";

import type { RefObject } from "react";
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
      <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-foreground px-4 py-3 text-sm text-background sm:max-w-[70%]">
        {content}
      </div>
      <Avatar className="mt-0.5 shrink-0">
        <AvatarImage src={user?.image ?? undefined} alt={user?.name ?? ""} />
        <AvatarFallback className="text-xs">
          {getInitials(user?.name)}
        </AvatarFallback>
      </Avatar>
    </div>
  );
}

/* ─── Assistant message bubble ───────────────────────────────────────────── */

function AssistantMessage({ message }: { message: GlobalChatMessage }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 size-10 shrink-0">
        <NetworkGraph />
      </div>
      <div className="max-w-[90%] sm:max-w-[80%]">
        <div className="text-sm text-foreground">
          <FormattedText text={message.content} />
        </div>
      </div>
    </div>
  );
}

/* ─── Typing indicator ───────────────────────────────────────────────────── */

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-start gap-3"
    >
      <div className="mt-0.5 size-10 shrink-0">
        <NetworkGraph isTalking />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted px-4 py-3">
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
        <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
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
  // Separate action buttons from regular suggestion chips
  const actionSuggestions = dynamicSuggestions.filter(
    (s) => s.action === "create_project" || s.action === "create_design",
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
            {messages.map((msg) => (
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
                  <AssistantMessage message={msg} />
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {isProcessing && <TypingIndicator />}
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
