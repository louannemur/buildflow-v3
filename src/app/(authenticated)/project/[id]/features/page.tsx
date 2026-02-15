import type { Metadata } from "next";
import { FeaturesContent } from "./features-content";

export const metadata: Metadata = {
  title: "Features | Calypso",
};

export default function FeaturesPage() {
  return <FeaturesContent />;
}
