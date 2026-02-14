import type { Metadata } from "next";
import { ReturnContent } from "./return-content";

export const metadata: Metadata = {
  title: "Checkout Complete | BuildFlow",
};

export default function ReturnPage() {
  return <ReturnContent />;
}
