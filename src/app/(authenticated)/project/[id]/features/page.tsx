import type { Metadata } from "next";
import { FeaturesContent } from "./features-content";

export const metadata: Metadata = {
  title: "Features | BuildFlow",
};

export default function FeaturesPage() {
  return <FeaturesContent />;
}
