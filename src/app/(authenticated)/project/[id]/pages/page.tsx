import type { Metadata } from "next";
import { PagesContent } from "./pages-content";

export const metadata: Metadata = {
  title: "Pages & Content | Calypso",
};

export default function PagesPage() {
  return <PagesContent />;
}
