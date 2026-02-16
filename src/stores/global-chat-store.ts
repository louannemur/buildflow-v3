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
  intent?: "new_project" | "new_design" | "general" | "project_action";
  projectName?: string;
  projectDescription?: string;
  actions?: ProjectAction[];
}

export interface GlobalSuggestion {
  label: string;
  action: "create_project" | "create_design" | "send_message";
  text?: string;
}

interface GlobalChatState {
  isOpen: boolean;
  messages: GlobalChatMessage[];
  suggestions: GlobalSuggestion[];
  isProcessing: boolean;

  toggle: () => void;
  setOpen: (open: boolean) => void;
  addMessage: (msg: GlobalChatMessage) => void;
  setSuggestions: (suggestions: GlobalSuggestion[]) => void;
  setProcessing: (processing: boolean) => void;
  clearMessages: () => void;
}

export const useGlobalChatStore = create<GlobalChatState>((set) => ({
  isOpen: false,
  messages: [],
  suggestions: [],
  isProcessing: false,

  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  addMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  setSuggestions: (suggestions) => set({ suggestions }),
  setProcessing: (isProcessing) => set({ isProcessing }),
  clearMessages: () => set({ messages: [], suggestions: [] }),
}));
