import { create } from "zustand";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  editType?: "full-page" | "element" | "add-section" | "general";
}

interface ChatHistoryState {
  conversations: Record<string, ChatMessage[]>;
  addMessage: (
    designId: string,
    message: Omit<ChatMessage, "id" | "timestamp">,
  ) => void;
  clearHistory: (designId: string) => void;
  getHistory: (designId: string) => ChatMessage[];
}

const MAX_MESSAGES = 20;

export const useChatHistoryStore = create<ChatHistoryState>((set, get) => ({
  conversations: {},

  addMessage: (designId, message) => {
    set((state) => {
      const existing = state.conversations[designId] || [];
      const newMessage: ChatMessage = {
        ...message,
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
      };
      const updated = [...existing, newMessage].slice(-MAX_MESSAGES);
      return {
        conversations: {
          ...state.conversations,
          [designId]: updated,
        },
      };
    });
  },

  clearHistory: (designId) => {
    set((state) => ({
      conversations: {
        ...state.conversations,
        [designId]: [],
      },
    }));
  },

  getHistory: (designId) => {
    return get().conversations[designId] || [];
  },
}));
