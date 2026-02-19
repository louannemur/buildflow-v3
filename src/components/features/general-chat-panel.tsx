"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
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
import { useEditorStore } from "@/lib/editor/store";
import { useMentionSystem } from "@/hooks/useMentionSystem";
import type { ReferenceOption } from "@/lib/design/reference-resolver";
import { readSSEStream } from "@/lib/sse-client";

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

/* ─── Editor constants ────────────────────────────────────────────────────── */

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

export function GeneralChatPanel() {
  const pathname = usePathname();
  const router = useRouter();

  const isOpen = useGlobalChatStore((s) => s.isOpen);
  const messages = useGlobalChatStore((s) => s.messages);
  const suggestions = useGlobalChatStore((s) => s.suggestions);
  const isProcessing = useGlobalChatStore((s) => s.isProcessing);
  const historyOpen = useGlobalChatStore((s) => s.historyOpen);
  const conversations = useGlobalChatStore((s) => s.conversations);
  const editorCallbacks = useGlobalChatStore((s) => s.editorCallbacks);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isEditor = isEditorRoute(pathname);
  const projectId = getProjectId(pathname);
  const projectName = useProjectStore((s) => s.project?.name);

  // Editor state (only read when on editor routes)
  const selectedElement = useEditorStore((s) => s.selectedElement);
  const selectedBfId = useEditorStore((s) => s.selectedBfId);
  const setSelectedBfId = useEditorStore((s) => s.setSelectedBfId);
  const elementTree = useEditorStore((s) => s.elementTree);
  const isGenerating = useEditorStore((s) => s.isStreamingToIframe);
  const deleteElement = useEditorStore((s) => s.deleteElement);

  // @ mention system for editor routes
  const features = useProjectStore((s) => s.features);
  const userFlows = useProjectStore((s) => s.userFlows);
  const pages = useProjectStore((s) => s.pages);

  const referenceOptions = useMemo<ReferenceOption[]>(() => {
    if (!isEditor) return [];
    const opts: ReferenceOption[] = [];
    pages.forEach((p) => {
      opts.push({ type: "page", label: p.title, value: `@page:${p.title}` });
    });
    features.forEach((f) => {
      opts.push({ type: "feature", label: f.title, value: `@feature:${f.title}` });
    });
    userFlows.forEach((f) => {
      opts.push({ type: "flow", label: f.title, value: `@flow:${f.title}` });
    });
    return opts;
  }, [isEditor, pages, features, userFlows]);

  const mention = useMentionSystem(referenceOptions);

  // For non-editor routes, use an uncontrolled input
  const inputValueRef = useRef("");
  const plainInputRef = useRef<HTMLTextAreaElement>(null);

  // Editor-specific suggestions
  const editorSuggestions = useMemo(() => {
    if (!isEditor) return [];
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
  }, [isEditor, selectedElement]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Auto-focus input when panel opens
  useEffect(() => {
    if (isOpen && !historyOpen) {
      setTimeout(() => {
        if (isEditor) {
          mention.inputRef.current?.focus();
        } else {
          plainInputRef.current?.focus();
        }
      }, 100);
    }
  }, [isOpen, isEditor, historyOpen, mention.inputRef]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        if (mention.showMentionMenu) {
          mention.setShowMentionMenu(false);
          return;
        }
        const store = useGlobalChatStore.getState();
        if (store.historyOpen) {
          store.setHistoryOpen(false);
        } else {
          store.setOpen(false);
          // Also sync editor store
          if (isEditor) {
            useEditorStore.getState().setShowChat(false);
          }
        }
      }
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, isEditor, mention]);

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

  // ─── Editor dispatch helper ───────────────────────────────────

  const dispatchEditorEdit = useCallback(
    (request: string) => {
      if (!editorCallbacks) return;

      const isAddSection = ADD_SECTION_KEYWORDS.some((kw) =>
        request.toLowerCase().includes(kw),
      );

      const editType = selectedElement
        ? isAddSection
          ? "add-section"
          : "element-edit"
        : "page-edit";

      // Add user message
      const store = useGlobalChatStore.getState();
      store.addMessage({
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: request,
        intent: "design_edit",
        editType:
          editType === "add-section"
            ? "add-section"
            : editType === "element-edit"
              ? "element"
              : "full-page",
      });

      if (editType === "element-edit" && selectedBfId) {
        editorCallbacks.onElementEdit(selectedBfId, request);
      } else if (editType === "add-section") {
        const afterBfId = selectedBfId || elementTree.at(-1)?.bfId;
        if (afterBfId) {
          editorCallbacks.onAddSection(afterBfId, request);
        } else {
          editorCallbacks.onEditDesign(request);
        }
      } else {
        editorCallbacks.onEditDesign(request);
      }
    },
    [editorCallbacks, selectedElement, selectedBfId, elementTree],
  );

  // ─── Chat logic ────────────────────────────────────────────────

  const handleSubmit = useCallback(
    async (text?: string) => {
      const message = isEditor
        ? (text ?? mention.editInput).trim()
        : (text ?? inputValueRef.current).trim();
      if (!message || isProcessing) return;

      // Editor route with registered callbacks → dispatch as design edit
      if (isEditor && editorCallbacks) {
        dispatchEditorEdit(message);
        mention.setEditInput("");
        return;
      }

      const store = useGlobalChatStore.getState();

      // Add user message
      const userMsg: GlobalChatMessage = {
        id: `msg-${Date.now()}-user`,
        role: "user",
        content: message,
      };
      store.addMessage(userMsg);
      store.setSuggestions([]);

      if (isEditor) {
        mention.setEditInput("");
      } else {
        inputValueRef.current = "";
        if (plainInputRef.current) plainInputRef.current.value = "";
      }

      // ── Detect action phrases and trigger actions directly ──
      const lower = message.toLowerCase().replace(/[.!?]+$/, "");
      const isBuildAction = /^(start building|build it|let'?s build|build everything|create the project|create it|let'?s go|make it|build this)$/.test(lower);
      const isDesignAction = /^(start designing|design it|let'?s design|create the design|design this)$/.test(lower);

      if (isBuildAction || isDesignAction) {
        const lastAssistant = [...store.messages].reverse().find((m) => m.role === "assistant");
        if (lastAssistant) {
          if ((isBuildAction && lastAssistant.intent === "new_project") || (isDesignAction && lastAssistant.intent === "new_project")) {
            const projectName = lastAssistant.projectName || "your project";
            store.addMessage({
              id: `msg-${Date.now()}-status`,
              role: "assistant",
              content: `Setting up **${projectName}**. This will just take a moment...`,
              intent: "new_project",
            });
            store.setProcessing(true);
            try {
              const history = store.messages.map((m) => ({ role: m.role, content: m.content }));
              const name = lastAssistant.projectName || "Untitled Project";
              const description = lastAssistant.projectDescription;
              const res = await fetch("/api/projects/create-from-chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, description, history }),
              });
              if (res.ok) {
                const project = await res.json();
                store.setOpen(false);
                router.push(`/project/${project.id}`);
              } else {
                toast.error("Failed to create project.");
              }
            } finally {
              store.setProcessing(false);
            }
            return;
          }
          if (isDesignAction && lastAssistant.intent === "new_design") {
            const designName = lastAssistant.projectName || "your design";
            store.addMessage({
              id: `msg-${Date.now()}-status`,
              role: "assistant",
              content: `Creating **${designName}**. One moment...`,
              intent: "new_design",
            });
            store.setProcessing(true);
            try {
              const res = await fetch("/api/designs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: lastAssistant.projectName || "Untitled Design" }),
              });
              if (res.ok) {
                const design = await res.json();
                store.setOpen(false);
                router.push(`/design/${design.id}?autoGenerate=true`);
              } else {
                toast.error("Failed to create design.");
              }
            } finally {
              store.setProcessing(false);
            }
            return;
          }
        }
      }

      store.setProcessing(true);

      try {
        const history = store.messages.map((m) => ({
          role: m.role,
          content: m.role === "assistant" && m.actions?.length
            ? `${m.content}\n\n[Actions taken: ${m.actions.map((a) => `${a.tool}(${JSON.stringify(a.data)})`).join(", ")}]`
            : m.content,
        }));

        // Use project-action endpoint when on a project route (streaming)
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

          // Create a streaming message that updates as text arrives
          const streamMsgId = `msg-${Date.now()}-ast`;
          store.addMessage({
            id: streamMsgId,
            role: "assistant",
            content: "",
            intent: "project_action",
          });

          let streamedText = "";
          const streamActions: ProjectAction[] = [];

          await readSSEStream(res, {
            onEvent: (event) => {
              if (event.type === "action") {
                const action = event.action as ProjectAction;
                if (action.success) streamActions.push(action);
                store.updateMessage(streamMsgId, {
                  actions: streamActions.length > 0 ? [...streamActions] : undefined,
                });
              } else if (event.type === "text") {
                streamedText += event.text as string;
                store.updateMessage(streamMsgId, { content: streamedText });
              } else if (event.type === "done") {
                const allActions = (event.actions as ProjectAction[]) ?? [];
                const successActions = allActions.filter((a) => a.success);
                store.updateMessage(streamMsgId, {
                  content: streamedText || "Done!",
                  actions: successActions.length > 0 ? successActions : undefined,
                });
              }
            },
            onError: () => {
              store.updateMessage(streamMsgId, {
                content: streamedText || "Something went wrong. Please try again.",
              });
            },
          });

          // Refresh project store after all actions
          if (streamActions.length > 0) {
            await refreshProjectData(streamActions);
          }

          // Navigate user to the relevant step after actions
          if (streamActions.length > 0 && projectId) {
            let target: string | null = null;

            const navAction = streamActions.find(
              (a) => a.tool === "navigate_to_step",
            );
            if (navAction) {
              const navData = navAction.data as Record<string, unknown>;
              const step = navData?.step as string;
              const pageId = navData?.page_id as string | null;
              target = `/project/${projectId}/${step}`;
              if (step === "designs" && pageId) {
                target = `/project/${projectId}/designs/${pageId}?autoGenerate=true`;
              }
            } else {
              const lastAction = streamActions[streamActions.length - 1];
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
          navPayload?: string | null,
        ): GlobalSuggestion[] {
          const chips: GlobalSuggestion[] = sug.map((s) => ({
            label: s,
            action: "send_message" as const,
            text: s,
          }));
          if (intent === "manage_project" && navPayload) {
            chips.push({
              label: "Go to project",
              action: "go_to_project",
              text: navPayload,
            });
          } else if (hasEnoughContext) {
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
          case "manage_project": {
            store.addMessage({
              id: `msg-${Date.now()}-ast`,
              role: "assistant",
              content:
                data.message ||
                `Let me take you to **${data.name || "your project"}**!`,
              intent: "manage_project",
              projectName: data.name,
            });
            const navPayload = data.projectId
              ? JSON.stringify({ projectId: data.projectId, step: data.step ?? null, pageId: data.pageId ?? null, userMessage: message })
              : null;
            store.setSuggestions(
              buildSuggestions("manage_project", aiSuggestions, data.name, navPayload),
            );
            break;
          }
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
    [isProcessing, projectId, isEditor, editorCallbacks, mention, dispatchEditorEdit, refreshProjectData, router],
  );

  // ─── Actions ───────────────────────────────────────────────────

  const handleSuggestionClick = useCallback(
    async (suggestion: GlobalSuggestion) => {
      const store = useGlobalChatStore.getState();

      switch (suggestion.action) {
        case "go_to_project": {
          if (suggestion.text) {
            store.setOpen(false);
            try {
              const nav = JSON.parse(suggestion.text) as { projectId: string; step?: string | null; pageId?: string | null; userMessage?: string };
              let target = `/project/${nav.projectId}`;
              if (nav.step) {
                target += `/${nav.step}`;
                if (nav.step === "designs" && nav.pageId) {
                  target += `/${nav.pageId}`;
                  if (nav.userMessage) {
                    store.setPendingEditorPrompt(nav.userMessage);
                  }
                }
              }
              router.push(target);
            } catch {
              router.push(`/project/${suggestion.text}`);
            }
          }
          break;
        }
        case "create_project": {
          const lastProjectMsg = [...store.messages]
            .reverse()
            .find((m) => m.role === "assistant" && m.intent === "new_project");
          const history = store.messages.map((m) => ({
            role: m.role,
            content: m.content,
          }));
          const name =
            lastProjectMsg?.projectName ||
            suggestion.text ||
            "Untitled Project";
          store.addMessage({
            id: `msg-${Date.now()}-status`,
            role: "assistant",
            content: `Setting up **${name}**. This will just take a moment...`,
            intent: "new_project",
          });
          store.setSuggestions([]);
          store.setProcessing(true);
          try {
            const hasHistory = history.length > 0;
            const endpoint = hasHistory
              ? "/api/projects/create-from-chat"
              : "/api/projects";
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
          const name =
            lastDesignMsg?.projectName ||
            suggestion.text ||
            "Untitled Design";
          store.addMessage({
            id: `msg-${Date.now()}-status`,
            role: "assistant",
            content: `Creating **${name}**. One moment...`,
            intent: "new_design",
          });
          store.setSuggestions([]);
          store.setProcessing(true);
          try {
            const res = await fetch("/api/designs", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name }),
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
            router.push(`/design/${design.id}?autoGenerate=true`);
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

  // ─── Editor suggestion handler ────────────────────────────────

  const handleEditorSuggestionClick = useCallback(
    (label: string, action: string) => {
      if (!editorCallbacks) return;

      if (action === "remove") {
        if (selectedBfId) {
          deleteElement(selectedBfId);
          const store = useGlobalChatStore.getState();
          store.addMessage({
            id: `msg-${Date.now()}-user`,
            role: "user",
            content: label,
            intent: "design_edit",
          });
          store.addMessage({
            id: `msg-${Date.now()}-ast`,
            role: "assistant",
            content: "Element removed from the design",
            intent: "design_edit",
          });
        }
        return;
      }

      dispatchEditorEdit(label);
    },
    [editorCallbacks, selectedBfId, deleteElement, dispatchEditorEdit],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // On editor routes, handle @ mention navigation first
    if (isEditor) {
      const handled = mention.handleMentionKeyDown(e);
      if (handled) return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClose = () => {
    useGlobalChatStore.getState().setOpen(false);
    if (isEditor) {
      useEditorStore.setState({ showChat: false });
    }
  };

  // ─── Dynamic text ─────────────────────────────────────────────

  const headerTitle = historyOpen
    ? "Chat History"
    : isEditor
      ? "AI Editor"
      : projectId
        ? projectName || "Project AI"
        : "Calypso AI";
  const headerSubtitle = historyOpen
    ? "Your past conversations"
    : isProcessing || (isEditor && isGenerating)
      ? isEditor ? "Editing..." : "Thinking..."
      : isEditor
        ? "Describe changes to your design"
        : projectId
          ? "I can manage your project"
          : "Ask me anything about your projects";
  const emptyTitle = isEditor
    ? "No edits yet"
    : projectId
      ? "How can I help with this project?"
      : "Hi! I\u2019m Calypso";
  const emptyDescription = isEditor
    ? "Select an element and describe what to change, or edit the full page"
    : projectId
      ? "I can add, update, or remove features, user flows, and pages. Just tell me what you need!"
      : "I can help you create projects and designs. Describe what you\u2019d like to build!";
  const placeholder = isEditor
    ? selectedElement
      ? `Edit <${selectedElement.tag}>... (type @ to reference)`
      : "Describe what to change... (type @ to reference)"
    : projectId
      ? "Ask me to change your project..."
      : "Describe a project or design...";

  const isDisabled = isProcessing || (isEditor && isGenerating);

  // ─── Render ────────────────────────────────────────────────────

  let flatMentionIdx = 0;

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
                state={isDisabled ? "active" : "idle"}
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
              onClick={handleClose}
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
                        className={`inline-block max-w-[85%] rounded-xl px-3 py-2 text-left text-sm leading-relaxed ${
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
                      {/* Show edit type badge for design edits */}
                      {msg.editType && (
                        <div className={`mt-0.5 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                            {EDIT_TYPE_LABELS[msg.editType] || msg.editType}
                          </span>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Editor-specific: Element context + suggestions */}
              {isEditor && (
                <div className="border-t border-border/40 px-3 py-2">
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
                        <X className="size-2" />
                      </button>
                      <span className="text-[10px] text-muted-foreground">
                        Editing element
                      </span>
                    </div>
                  )}

                  {/* Quick suggestions */}
                  <div className="flex flex-wrap gap-1">
                    {editorSuggestions.map((s) => (
                      <button
                        key={s.label}
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                          s.action === "remove"
                            ? "bg-destructive/10 text-destructive hover:bg-destructive/20"
                            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                        }`}
                        onClick={() => handleEditorSuggestionClick(s.label, s.action)}
                        disabled={isDisabled}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Non-editor: Suggestions */}
              {!isEditor && suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-t border-border/40 px-4 py-2">
                  {suggestions.map((s) => (
                    <button
                      key={s.label}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        s.action === "create_project" ||
                        s.action === "create_design" ||
                        s.action === "go_to_project"
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
                  {isEditor ? (
                    /* Editor: controlled input with @ mention support */
                    <div className="relative flex-1">
                      <textarea
                        ref={mention.inputRef}
                        className="w-full resize-none rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                        placeholder={placeholder}
                        rows={2}
                        value={mention.editInput}
                        onChange={mention.handleInputChange}
                        onKeyDown={handleKeyDown}
                        disabled={isDisabled}
                      />

                      {/* @ Mention dropdown */}
                      {mention.showMentionMenu && mention.flatOptions.length > 0 && (
                        <div
                          ref={mention.menuRef}
                          className="absolute bottom-full left-0 mb-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border/60 bg-background shadow-lg"
                        >
                          {mention.groupedOptions.map((group) => (
                            <div key={group.type}>
                              <div className="px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
                                {group.label}
                              </div>
                              {group.items.map((option) => {
                                const idx = flatMentionIdx++;
                                return (
                                  <button
                                    key={option.value}
                                    type="button"
                                    className={`flex w-full items-center gap-2 px-2 py-1.5 text-xs transition-colors ${
                                      idx === mention.mentionIndex
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-muted"
                                    }`}
                                    data-mention-idx={idx}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      mention.insertMention(option);
                                    }}
                                    onMouseEnter={() => mention.setMentionIndex(idx)}
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

                      {mention.showMentionMenu &&
                        mention.flatOptions.length === 0 &&
                        mention.editInput.includes("@") && (
                          <div className="absolute bottom-full left-0 mb-1 rounded-lg border border-border/60 bg-background px-3 py-2 shadow-lg">
                            <span className="text-xs text-muted-foreground">
                              No matches
                            </span>
                          </div>
                        )}
                    </div>
                  ) : (
                    /* Non-editor: uncontrolled input */
                    <textarea
                      ref={plainInputRef}
                      className="flex-1 resize-none rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/40 focus:outline-none focus:ring-1 focus:ring-primary/20"
                      placeholder={placeholder}
                      rows={2}
                      onChange={(e) => {
                        inputValueRef.current = e.target.value;
                      }}
                      onKeyDown={handleKeyDown}
                      disabled={isProcessing}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors disabled:opacity-50"
                    disabled={isDisabled}
                  >
                    {isDisabled ? (
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
