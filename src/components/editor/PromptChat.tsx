"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { useChatHistoryStore } from "@/stores/chat-history-store";

interface PromptChatProps {
  designId: string;
}

const EDIT_TYPE_LABELS: Record<string, string> = {
  "full-page": "Page edit",
  element: "Element edit",
  "add-section": "Section added",
  general: "Edit",
};

export function PromptChat({ designId }: PromptChatProps) {
  const { conversations, clearHistory } = useChatHistoryStore();
  const messages = conversations[designId] || [];
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const formatTime = (timestamp: string) => {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="border-t border-border/60 bg-background">
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-medium text-muted-foreground">Edit History</span>
        {messages.length > 0 && (
          <button
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => clearHistory(designId)}
          >
            <Trash2 className="size-3" />
            Clear
          </button>
        )}
      </div>

      <div className="max-h-48 overflow-y-auto px-4 pb-2">
        {messages.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground/60">Edit history will appear here</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`mb-2 ${msg.role === "user" ? "text-right" : "text-left"}`}
            >
              <div
                className={`inline-block max-w-[85%] rounded-lg px-3 py-1.5 text-xs ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.content}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 justify-end">
                {msg.role === "assistant" && msg.editType && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {EDIT_TYPE_LABELS[msg.editType] || msg.editType}
                  </span>
                )}
                <span className="text-[9px] text-muted-foreground/60">{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}
