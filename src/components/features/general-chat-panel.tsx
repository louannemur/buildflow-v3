"use client";

import { useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Loader2,
  X,
  Check,
  AlertCircle,
  SquarePen,
  Clock,
  ArrowLeft,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ChatAvatar } from "./chat-avatar";
import {
  useGlobalChatStore,
  type GlobalChatMessage,
  type GlobalSuggestion,
  type ProjectAction,
  type ConversationSummary,
} from "@/stores/global-chat-store";
import { useProjectStore } from "@/stores/project-store";

/* ─── Route helpers ───────────────────────────────────────────────────────── */

function isEditorRoute(pathname: string): boolean {
  return (
    /^\/design\/[^/]+$/.test(pathname) ||
    /^\/project\/[^/]+\/designs\/[^/]+$/.test(pathname)
  );
}

function getProjectId(pathname: string): string | null {
  const match = pathname.match(/^\/project\/([^/]+)/);
  return match ? match[1] : null;
}

/* ─── Action label helper ─────────────────────────────────────────────────── */

const STEP_LABELS: Record<string, string> = {
  features: "Features",
  flows: "User Flows",
  pages: "Pages",
  designs: "Designs",
  build: "Build",
};

function actionLabel(action: ProjectAction): string {
  const data = action.data as Record<string, unknown> | undefined;
  const name = data?.title ?? data?.name ?? "";
  switch (action.tool) {
    case "add_feature":
      return `Added feature${name ? `: ${name}` : ""}`;
    case "update_feature":
      return `Updated feature${name ? `: ${name}` : ""}`;
    case "delete_feature":
      return "Deleted feature";
    case "add_flow":
      return `Added flow${name ? `: ${name}` : ""}`;
    case "update_flow":
      return `Updated flow${name ? `: ${name}` : ""}`;
    case "delete_flow":
      return "Deleted flow";
    case "add_page":
      return `Added page${name ? `: ${name}` : ""}`;
    case "update_page":
      return `Updated page${name ? `: ${name}` : ""}`;
    case "delete_page":
      return "Deleted page";
    case "navigate_to_step": {
      const step = data?.step as string;
      return `Navigating to ${STEP_LABELS[step] ?? step}`;
    }
    default:
      return action.tool;
  }
}

/* ─── Relative time helper ────────────────────────────────────────────────── */

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export function GeneralChatPanel() {
  const pathname = usePathname();
  const router = useRouter();

  const isOpen = useGlobalChatStore((s) => s.isOpen);
  const messages = useGlobalChatStore((s) => s.messages);
  const suggestions = useGlobalChatStore((s) => s.suggestions);
  const isProcessing = useGlobalChatStore((s) => s.isProcessing);
  const historyOpen = useGlobalChatStore((s) => s.historyOpen);
  const conversations = useGlobalChatStore((s) => s.conversations);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputValueRef = useRef("");

  // Don't render on editor routes (editor has its own chat)
  const isEditor = isEditorRoute(pathname);
  const projectId = getProjectId(pathname);
  const projectName = useProjectStore((s) => s.project?.name);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen && !isEditor && !historyOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, isEditor, historyOpen]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        const store = useGlobalChatStore.getState();
        if (store.historyOpen) {
          store.setHistoryOpen(false);
        } else {
          store.setOpen(false);
        }
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // ─── Refresh project store after actions ──────────────────────

  const refreshProjectData = useCallback(
    async (actions: ProjectAction[]) => {
      if (!projectId || actions.length === 0) return;

      const touchedFeatures = actions.some((a) =>
        a.tool.includes("feature"),
      );
      const touchedFlows = actions.some((a) => a.tool.includes("flow"));
      const touchedPages = actions.some((a) => a.tool.includes("page"));

      const store = useProjectStore.getState();

      const fetches: Promise<void>[] = [];

      if (touchedFeatures) {
        fetches.push(
          fetch(`/api/projects/${projectId}/features`)
            .then((r) => r.json())
            .then((data) => store.setFeatures(data.items)),
        );
      }
      if (touchedFlows) {
        fetches.push(
          fetch(`/api/projects/${projectId}/flows`)
            .then((r) => r.json())
            .then((data) => store.setUserFlows(data.items)),
        );
      }
      if (touchedPages) {
        fetches.push(
          fetch(`/api/projects/${projectId}/pages`)
            .then((r) => r.json())
            .then((data) => store.setPages(data.items)),
        );
      }

      await Promise.all(fetches);
    },
    [projectId],
  );

  // ─── Chat logic ────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (text?: string) => {
      const message = (text ?? inputValueRef.current).trim();
      if (!message || isProcessing) return;

      const store = useGlobalChatStore.getState();

      // Add user message
      const userMsg: GlobalChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: message,
      };
      store.addMessage(userMsg);
      store.setSuggestions([]);
      inputValueRef.current = "";
      if (inputRef.current) inputRef.current.value = "";

      store.setProcessing(true);

      try {
        const history = store.messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        // Use project-action endpoint when on a project route
        if (projectId) {
          const res = await fetch("/api/chat/project-action", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, projectId, history }),
          });

          if (!res.ok) {
            store.addMessage({
              id: `msg-${Date.now()}-err`,
              role: "assistant",
              content: "Something went wrong. Please try again.",
              intent: "general",
            });
            return;
          }

          const data = await res.json();
          const actions: ProjectAction[] = data.actions ?? [];
          const successActions = actions.filter((a) => a.success);

          store.addMessage({
            id: `msg-${Date.now()}-ast`,
            role: "assistant",
            content: data.message,
            intent: "project_action",
            actions: successActions.length > 0 ? successActions : undefined,
          });

          // Refresh project store
          if (successActions.length > 0) {
            await refreshProjectData(successActions);
          }

          // Navigate user to the relevant step after actions
          if (successActions.length > 0 && projectId) {
            let target: string | null = null;

            // Explicit navigation action takes priority
            const navAction = successActions.find(
              (a) => a.tool === "navigate_to_step",
            );
            if (navAction) {
              const navData = navAction.data as Record<string, unknown>;
              const step = navData?.step as string;
              const pageId = navData?.page_id as string | null;
              target = `/project/${projectId}/${step}`;
              if (step === "designs" && pageId) {
                target = `/project/${projectId}/designs/${pageId}`;
              }
            } else {
              // Auto-navigate based on which tools were used
              const lastAction = successActions[successActions.length - 1];
              if (lastAction.tool.includes("feature")) {
                target = `/project/${projectId}/features`;
              } else if (lastAction.tool.includes("flow")) {
                target = `/project/${projectId}/flows`;
              } else if (lastAction.tool.includes("page")) {
                target = `/project/${projectId}/pages`;
              }
            }

            if (target) {
              setTimeout(() => {
                router.push(target);
              }, 600);
            }
          }

          return;
        }

        // Default: classify endpoint for non-project pages
        const res = await fetch("/api/chat/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message, history }),
        });

        if (!res.ok) {
          store.addMessage({
            id: `msg-${Date.now()}-err`,
            role: "assistant",
            content: "Something went wrong. Please try again.",
            intent: "general",
          });
          return;
        }

        const data = await res.json();
        const aiSuggestions: string[] = data.suggestions ?? [];
        const hasEnoughContext = store.messages.length >= 3;

        function buildSuggestions(
          intent: string,
          sug: string[],
          actionName?: string,
        ): GlobalSuggestion[] {
          const chips: GlobalSuggestion[] = sug.map((s) => ({
            label: s,
            action: "send_message" as const,
            text: s,
          }));
          if (hasEnoughContext) {
            if (intent === "new_project") {
              chips.push({
                label: "Build everything",
                action: "create_project",
                text: actionName,
              });
            } else if (intent === "new_design") {
              chips.push({
                label: "Start designing",
                action: "create_design",
                text: actionName,
              });
            }
          }
          return chips;
        }

        switch (data.intent) {
          case "new_project": {
            store.addMessage({
              id: `msg-${Date.now()}-ast`,
              role: "assistant",
              content:
                data.message ||
                `I'd love to help you build **${data.name || "your project"}**!`,
              intent: "new_project",
              projectName: data.name,
              projectDescription: data.description,
            });
            store.setSuggestions(
              buildSuggestions("new_project", aiSuggestions, data.name),
            );
            break;
          }
          case "new_design": {
            store.addMessage({
              id: `msg-${Date.now()}-ast`,
              role: "assistant",
              content:
                data.message ||
                `Let's design **${data.name || "your design"}**!`,
              intent: "new_design",
              projectName: data.name,
            });
            store.setSuggestions(
              buildSuggestions("new_design", aiSuggestions, data.name),
            );
            break;
          }
          case "general":
          default: {
            store.addMessage({
              id: `msg-${Date.now()}-ast`,
              role: "assistant",
              content:
                data.message ||
                "Try describing a project or design you'd like to create!",
              intent: "general",
            });
            store.setSuggestions(
              aiSuggestions.length > 0
                ? aiSuggestions.map((s) => ({
                    label: s,
                    action: "send_message" as const,
                    text: s,
                  }))
                : [
                    {
                      label: "Create a project",
                      action: "send_message" as const,
                      text: "Create a new project",
                    },
                    {
                      label: "Create a design",
                      action: "send_message" as const,
                      text: "Create a new standalone design",
                    },
                  ],
            );
            break;
          }
        }
      } catch {
        useGlobalChatStore.getState().addMessage({
          id: `msg-${Date.now()}-err`,
          role: "assistant",
          content: "Something went wrong. Please try again.",
          intent: "general",
        });
      } finally {
        useGlobalChatStore.getState().setProcessing(false);
      }
    },
    [isProcessing, projectId, refreshProjectData, router],
  );

  // ─── Actions ───────────────────────────────────────────────────

  const handleSuggestionClick = useCallback(
    async (suggestion: GlobalSuggestion) => {
      const store = useGlobalChatStore.getState();

      switch (suggestion.action) {
        case "create_project": {
          const lastProjectMsg = [...store.messages]
            .reverse()
            .find((m) => m.role === "assistant" && m.intent === "new_project");
          const history = store.messages.map((m) => ({
            role: m.role,
            content: m.content,
          }));
          store.setProcessing(true);
          try {
            const hasHistory = history.length > 0;
            const endpoint = hasHistory
              ? "/api/projects/create-from-chat"
              : "/api/projects";
            const name =
              lastProjectMsg?.projectName ||
              suggestion.text ||
              "Untitled Project";
            const description = lastProjectMsg?.projectDescription;

            const res = await fetch(endpoint, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(
                hasHistory
                  ? { name, description, history }
                  : { name, description },
              ),
            });

            if (res.status === 403) {
              toast.error("Upgrade required to create more projects.");
              return;
            }
            if (!res.ok) {
              toast.error("Failed to create project. Please try again.");
              return;
            }

            const project = await res.json();
            store.setOpen(false);
            store.clearMessages();
            router.push(`/project/${project.id}`);
          } finally {
            store.setProcessing(false);
          }
          break;
        }
        case "create_design": {
          const lastDesignMsg = [...store.messages]
            .reverse()
            .find((m) => m.role === "assistant" && m.intent === "new_design");
          store.setProcessing(true);
          try {
            const res = await fetch("/api/designs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name:
                  lastDesignMsg?.projectName ||
                  suggestion.text ||
                  "Untitled Design",
              }),
            });

            if (res.status === 403) {
              toast.error("Upgrade required to create more designs.");
              return;
            }
            if (!res.ok) {
              toast.error("Failed to create design. Please try again.");
              return;
            }

            const design = await res.json();
            store.setOpen(false);
            store.clearMessages();
            router.push(`/design/${design.id}`);
          } finally {
            store.setProcessing(false);
          }
          break;
        }
        case "send_message": {
          if (suggestion.text) {
            await handleSubmit(suggestion.text);
          }
          break;
        }
      }
    },
    [handleSubmit, router],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Don't render on editor pages
  if (isEditor) return null;

  const headerTitle = historyOpen
    ? "Chat History"
    : projectId
      ? projectName || "Project AI"
      : "Calypso AI";
  const headerSubtitle = historyOpen
    ? "Your past conversations"
    : isProcessing
      ? "Thinking..."
      : projectId
        ? "I can manage your project"
        : "Ask me anything about your projects";
  const emptyTitle = projectId
    ? "How can I help with this project?"
    : "Hi! I\u2019m Calypso";
  const emptyDescription = projectId
    ? "I can add, update, or remove features, user flows, and pages. Just tell me what you need!"
    : "I can help you create projects and designs. Describe what you\u2019d like to build!";
  const placeholder = projectId
    ? "Ask me to change your project..."
    : "Describe a project or design...";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: -400 }}
          animate={{ x: 0 }}
          exit={{ x: -400 }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          className="fixed left-0 top-0 z-50 flex h-full w-full flex-col border-r border-border/60 bg-background shadow-xl sm:w-[400px]"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
            {historyOpen ? (
              <button
                onClick={() =>
                  useGlobalChatStore.getState().setHistoryOpen(false)
                }
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </button>
            ) : (
              <ChatAvatar
                state={isProcessing ? "active" : "idle"}
                size="sm"
              />
            )}
            <div className="flex-1">
              <h3 className="text-sm font-semibold">{headerTitle}</h3>
              <p className="text-[10px] text-muted-foreground">
                {headerSubtitle}
              </p>
            </div>
            {!historyOpen && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() =>
                    useGlobalChatStore
                      .getState()
                      .newConversation(projectId)
                  }
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="New chat"
                >
                  <SquarePen className="size-3.5" />
                </button>
                <button
                  onClick={() =>
                    useGlobalChatStore.getState().setHistoryOpen(true)
                  }
                  className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Chat history"
                >
                  <Clock className="size-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={() => useGlobalChatStore.getState().setOpen(false)}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {historyOpen ? (
            /* ─── History view ─────────────────────────────────────── */
            <div className="flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center px-4">
                  <Clock className="size-8 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">
                    No past conversations
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    Your chat history will appear here
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {conversations.map((conv) => (
                    <ConversationItem
                      key={conv.id}
                      conversation={conv}
                      onSelect={() =>
                        useGlobalChatStore
                          .getState()
                          .loadConversation(conv.id)
                      }
                      onDelete={() =>
                        useGlobalChatStore
                          .getState()
                          .deleteConversation(conv.id)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* ─── Chat view ────────────────────────────────────────── */
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <ChatAvatar
                      state="idle"
                      size="default"
                      className="mb-4"
                    />
                    <p className="text-sm font-medium">{emptyTitle}</p>
                    <p className="mt-1 max-w-[260px] text-[11px] text-muted-foreground">
                      {emptyDescription}
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`mb-3 ${msg.role === "user" ? "text-right" : "text-left"}`}
                    >
                      <div
                        className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        }`}
                      >
                        {msg.content}
                      </div>
                      {/* Show action badges for project actions */}
                      {msg.actions && msg.actions.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {msg.actions.map((action, i) => (
                            <span
                              key={i}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                action.success
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : "bg-destructive/10 text-destructive"
                              }`}
                            >
                              {action.success ? (
                                <Check className="size-2.5" />
                              ) : (
                                <AlertCircle className="size-2.5" />
                              )}
                              {actionLabel(action)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-border/40 px-4 py-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.label}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        s.action === "create_project" ||
                        s.action === "create_design"
                          ? "bg-primary text-primary-foreground hover:bg-primary/90"
                          : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                      onClick={() => handleSuggestionClick(s)}
                      disabled={isProcessing}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="border-t border-border/60 px-4 py-3">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    className="flex-1 resize-none rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                    placeholder={placeholder}
                    rows={2}
                    onChange={(e) => {
                      inputValueRef.current = e.target.value;
                    }}
                    onKeyDown={handleKeyDown}
                    disabled={isProcessing}
                  />
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors disabled:opacity-50"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Send className="size-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Conversation list item ──────────────────────────────────────────────── */

function ConversationItem({
  conversation,
  onSelect,
  onDelete,
}: {
  conversation: ConversationSummary;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors">
      <button
        onClick={onSelect}
        className="flex-1 min-w-0 text-left"
      >
        <p className="truncate text-sm font-medium">{conversation.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {timeAgo(conversation.updatedAt)}
        </p>
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/0 transition-colors group-hover:text-muted-foreground hover:!text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-3" />
      </button>
    </div>
  );
}
