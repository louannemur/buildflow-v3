import type { Metadata } from "next";
import { FlowsContent } from "./flows-content";

export const metadata: Metadata = {
  title: "User Flows | BuildFlow",
};

export default function FlowsPage() {
  return <FlowsContent />;
}
