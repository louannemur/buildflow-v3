"use client";

import dynamic from "next/dynamic";

const NetworkScene = dynamic(
  () =>
    import("./network-scene").then((mod) => ({
      default: mod.NetworkScene,
    })),
  {
    ssr: false,
    loading: () => <div style={{ width: "100%", height: "100%" }} />,
  },
);

interface NetworkGraphProps {
  isTalking?: boolean;
}

export function NetworkGraph({ isTalking = false }: NetworkGraphProps) {
  return (
    <div className="size-full">
      <NetworkScene isTalking={isTalking} />
    </div>
  );
}
