"use client";

import { cn } from "@/lib/utils";
import { NetworkGraph } from "./network-graph";

interface ChatAvatarProps {
  state: "idle" | "active";
  size?: "default" | "sm";
  className?: string;
}

const sizeClasses = {
  default: "size-14",
  sm: "size-10",
} as const;

export function ChatAvatar({ state, size = "default", className }: ChatAvatarProps) {
  return (
    <div
      className={cn(
        "relative shrink-0",
        sizeClasses[size],
        className,
      )}
    >
      <NetworkGraph isTalking={state === "active"} />
    </div>
  );
}
