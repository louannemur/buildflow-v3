import { create } from "zustand";

export interface ProjectAction {
  tool: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface GlobalChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: "new_project" | "new_design" | "general" | "project_action" | "design_edit";
  projectName?: string;
  projectDescription?: string;
  actions?: ProjectAction[];
  editType?: "full-page" | "element" | "add-section" | "general";
}

export interface EditorCallbacks {
  onEditDesign: (prompt: string) => void;
  onElementEdit: (bfId: string, prompt: string) => void;
  onAddSection: (afterBfId: string, prompt: string) => void;
}

export interface GlobalSuggestion {
  label: string;
  action: "create_project" | "create_design" | "send_message";
  text?: string;
}

export interface ConversationSummary {
  id: string;
  title: string;
  projectId: string | null;
  updatedAt: string;
}

interface GlobalChatState {
  isOpen: boolean;
  messages: GlobalChatMessage[];
  suggestions: GlobalSuggestion[];
  isProcessing: boolean;

  // Conversation persistence
  activeConversationId: string | null;
  conversations: ConversationSummary[];
  historyOpen: boolean;
  conversationsLoaded: boolean;

  toggle: () => void;
  setOpen: (open: boolean) => void;
  addMessage: (msg: GlobalChatMessage) => void;
  updateMessage: (id: string, updates: Partial<GlobalChatMessage>) => void;
  setSuggestions: (suggestions: GlobalSuggestion[]) => void;
  setProcessing: (processing: boolean) => void;
  clearMessages: () => void;
  setHistoryOpen: (open: boolean) => void;

  // Conversation actions
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  saveConversation: (projectId?: string | null) => Promise<void>;
  newConversation: (projectId?: string | null) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;

  // Editor integration
  editorCallbacks: EditorCallbacks | null;
  registerEditorCallbacks: (callbacks: EditorCallbacks) => void;
  unregisterEditorCallbacks: () => void;
}

/* ─── Debounced save helper ─────────────────────────────────────────────── */

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debouncedSave(projectId?: string | null) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    useGlobalChatStore.getState().saveConversation(projectId);
  }, 1000);
}

/* ─── Store ─────────────────────────────────────────────────────────────── */

export const useGlobalChatStore = create<GlobalChatState>((set, get) => ({
  isOpen: false,
  messages: [],
  suggestions: [],
  isProcessing: false,
  activeConversationId: null,
  conversations: [],
  historyOpen: false,
  conversationsLoaded: false,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),

  addMessage: (msg) => {
    set((s) => ({ messages: [...s.messages, msg] }));
    // Auto-save after assistant messages
    if (msg.role === "assistant") {
      debouncedSave();
    }
  },

  updateMessage: (id, updates) => {
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    }));
    // Re-trigger debounced save so the final content is captured
    const msg = get().messages.find((m) => m.id === id);
    if (msg?.role === "assistant") {
      debouncedSave();
    }
  },

  setSuggestions: (suggestions) => set({ suggestions }),
  setProcessing: (isProcessing) => set({ isProcessing }),

  clearMessages: () =>
    set({
      messages: [],
      suggestions: [],
      activeConversationId: null,
    }),

  setHistoryOpen: (open) => {
    set({ historyOpen: open });
    // Load conversations when opening history
    if (open && !get().conversationsLoaded) {
      get().loadConversations();
    }
  },

  loadConversations: async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      if (!res.ok) return;
      const data = await res.json();
      set({ conversations: data, conversationsLoaded: true });
    } catch {
      // Silently fail
    }
  },

  loadConversation: async (id) => {
    try {
      const res = await fetch(`/api/chat/conversations/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      set({
        activeConversationId: id,
        messages: data.messages ?? [],
        suggestions: [],
        historyOpen: false,
      });
    } catch {
      // Silently fail
    }
  },

  saveConversation: async (projectId) => {
    const { messages, activeConversationId } = get();
    if (messages.length === 0) return;

    // Derive title from first user message
    const firstUserMsg = messages.find((m) => m.role === "user");
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 60) +
        (firstUserMsg.content.length > 60 ? "..." : "")
      : "New conversation";

    // Serialize messages for DB (strip extra fields)
    const dbMessages = messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      intent: m.intent,
      actions: m.actions,
    }));

    try {
      if (activeConversationId) {
        // Update existing
        await fetch(`/api/chat/conversations/${activeConversationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: dbMessages, title }),
        });
        // Update in cached list
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === activeConversationId
              ? { ...c, title, updatedAt: new Date().toISOString() }
              : c,
          ),
        }));
      } else {
        // Create new
        const res = await fetch("/api/chat/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            projectId: projectId ?? null,
            messages: dbMessages,
          }),
        });
        if (res.ok) {
          const created = await res.json();
          set((s) => ({
            activeConversationId: created.id,
            conversations: [
              {
                id: created.id,
                title,
                projectId: created.projectId,
                updatedAt: created.updatedAt,
              },
              ...s.conversations,
            ],
          }));
        }
      }
    } catch {
      // Silently fail — don't disrupt chat
    }
  },

  newConversation: async (projectId) => {
    const { messages } = get();
    // Save current conversation if it has messages
    if (messages.length > 0) {
      await get().saveConversation(projectId);
    }
    set({
      messages: [],
      suggestions: [],
      activeConversationId: null,
      historyOpen: false,
    });
  },

  // Editor integration
  editorCallbacks: null,
  registerEditorCallbacks: (callbacks) => set({ editorCallbacks: callbacks }),
  unregisterEditorCallbacks: () => set({ editorCallbacks: null }),

  deleteConversation: async (id) => {
    try {
      await fetch(`/api/chat/conversations/${id}`, { method: "DELETE" });
      set((s) => ({
        conversations: s.conversations.filter((c) => c.id !== id),
        // If deleting the active conversation, clear it
        ...(s.activeConversationId === id
          ? { activeConversationId: null, messages: [], suggestions: [] }
          : {}),
      }));
    } catch {
      // Silently fail
    }
  },
}));
