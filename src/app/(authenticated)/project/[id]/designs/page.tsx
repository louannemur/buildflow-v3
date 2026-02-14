import type { Metadata } from "next";
import { DesignsContent } from "./designs-content";

export const metadata: Metadata = {
  title: "Designs | BuildFlow",
};

export default function DesignsPage() {
  return <DesignsContent />;
}
