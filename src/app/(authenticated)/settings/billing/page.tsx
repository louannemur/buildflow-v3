import type { Metadata } from "next";
import { Suspense } from "react";
import { BillingContent } from "./billing-content";

export const metadata: Metadata = {
  title: "Billing Settings | Calypso",
};

export default function BillingSettingsPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}
