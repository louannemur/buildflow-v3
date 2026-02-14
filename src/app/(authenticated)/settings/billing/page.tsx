import type { Metadata } from "next";
import { BillingContent } from "./billing-content";

export const metadata: Metadata = {
  title: "Billing Settings | BuildFlow",
};

export default function BillingSettingsPage() {
  return <BillingContent />;
}
