import type { Metadata } from "next";
import { BuildContent } from "./build-content";

export const metadata: Metadata = {
  title: "Build | Calypso",
};

export default function BuildPage() {
  return <BuildContent />;
}
