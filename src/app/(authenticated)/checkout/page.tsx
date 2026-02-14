import type { Metadata } from "next";
import { CheckoutContent } from "./checkout-content";

export const metadata: Metadata = {
  title: "Checkout | BuildFlow",
};

export default function CheckoutPage() {
  return <CheckoutContent />;
}
