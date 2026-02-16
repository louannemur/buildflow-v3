import type { Metadata } from "next";
import { PricingContent } from "@/components/features/pricing-content";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple, transparent pricing for every stage of your journey. Start free, upgrade when you're ready.",
};

export default function PricingPage() {
  return <PricingContent />;
}
