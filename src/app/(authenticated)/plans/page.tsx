import type { Metadata } from "next";
import { Suspense } from "react";
import { PlansContent } from "./plans-content";

export const metadata: Metadata = {
  title: "Plans | Calypso",
};

export default function PlansPage() {
  return (
    <Suspense>
      <PlansContent />
    </Suspense>
  );
}
