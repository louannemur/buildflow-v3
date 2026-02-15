"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ChatAvatarProps {
  state: "idle" | "active";
  className?: string;
}

export function ChatAvatar({ state, className }: ChatAvatarProps) {
  const isActive = state === "active";

  return (
    <div className={cn("relative", className)}>
      {/* Outer glow ring */}
      <motion.div
        className="absolute -inset-2 rounded-full bg-gradient-to-br from-primary/30 to-violet/30 blur-lg"
        animate={{
          opacity: isActive ? [0.4, 0.8, 0.4] : [0.1, 0.3, 0.1],
          scale: isActive ? [1, 1.15, 1] : [1, 1.05, 1],
        }}
        transition={{
          duration: isActive ? 1.2 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Main avatar */}
      <motion.div
        className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-violet shadow-lg"
        animate={{
          scale: isActive ? [1, 1.08, 1] : [1, 1.03, 1],
        }}
        transition={{
          duration: isActive ? 1.2 : 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        {/* Inner pulse ring (active only) */}
        {isActive && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary-foreground/30"
            animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
          />
        )}

        {/* Initials */}
        <span className="relative text-lg font-bold text-primary-foreground select-none">
          C
        </span>
      </motion.div>
    </div>
  );
}
