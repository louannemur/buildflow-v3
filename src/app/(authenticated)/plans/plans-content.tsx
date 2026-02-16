"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PricingContent } from "@/components/features/pricing-content";

export function PlansContent() {
  const router = useRouter();

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        className="fixed right-4 top-4 z-50 size-9 rounded-full"
        onClick={() => router.back()}
        aria-label="Close"
      >
        <X className="size-5" />
      </Button>
      <PricingContent />
    </div>
  );
}
