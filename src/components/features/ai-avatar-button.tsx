"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChatAvatar } from "./chat-avatar";
import { useEditorStore } from "@/lib/editor/store";
import { useGlobalChatStore } from "@/stores/global-chat-store";

function isEditorRoute(pathname: string): boolean {
  return (
    /^\/design\/[^/]+$/.test(pathname) ||
    /^\/project\/[^/]+\/designs\/[^/]+$/.test(pathname)
  );
}

export function AIAvatarButton() {
  const pathname = usePathname();

  // Hide on /home
  if (pathname === "/home") return null;

  const isEditor = isEditorRoute(pathname);

  const editorChatOpen = useEditorStore((s) => s.showChat);
  const globalChatOpen = useGlobalChatStore((s) => s.isOpen);
  const isOpen = isEditor ? editorChatOpen : globalChatOpen;

  const handleClick = () => {
    if (isEditor) {
      useEditorStore.getState().toggleChat();
    } else {
      useGlobalChatStore.getState().toggle();
    }
  };

  return (
    <AnimatePresence>
      {!isOpen && (
        <motion.button
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          onClick={handleClick}
          className="fixed bottom-6 left-6 z-50 cursor-pointer"
          aria-label="Open AI chat"
        >
          <ChatAvatar state="idle" size="default" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
