"use client";

import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChatAvatar } from "./chat-avatar";
import { useGlobalChatStore } from "@/stores/global-chat-store";

export function AIAvatarButton() {
  const pathname = usePathname();
  const isOpen = useGlobalChatStore((s) => s.isOpen);

  // Hide on /home (home has its own inline chat input)
  if (pathname === "/home") return null;

  const handleClick = () => {
    useGlobalChatStore.getState().toggle();
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
