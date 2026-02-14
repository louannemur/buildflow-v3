"use client";

import { useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from "@stripe/react-stripe-js";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLAN_DISPLAY: Record<
  string,
  { name: string; monthly: number; yearly: number | null }
> = {
  studio: { name: "Studio", monthly: 4.99, yearly: 49.9 },
  pro: { name: "Pro", monthly: 12.99, yearly: 129.9 },
  founding: { name: "Founding Partner", monthly: 6.99, yearly: null },
};

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!,
);

export function CheckoutContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get("plan") ?? "";
  const interval = searchParams.get("interval") ?? "monthly";
  const [redirectingToPortal, setRedirectingToPortal] = useState(false);

  const planInfo = PLAN_DISPLAY[plan];

  // Redirect existing subscribers to the billing portal
  const redirectToPortal = useCallback(async () => {
    setRedirectingToPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch {
      // Fall through to pricing page
    }
    router.push("/pricing");
  }, [router]);

  const fetchClientSecret = useCallback(async () => {
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planName: plan, interval }),
    });

    const data = await res.json();

    if (!res.ok) {
      // If the user already has a subscription, redirect to billing portal
      if (res.status === 400 && data.error?.includes("active subscription")) {
        redirectToPortal();
        // Return a never-resolving promise to prevent Stripe from timing out
        // while we redirect
        return new Promise<string>(() => {});
      }
      throw new Error(data.error ?? "Failed to create checkout session");
    }

    return data.clientSecret;
  }, [plan, interval, redirectToPortal]);

  if (redirectingToPortal) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Redirecting to subscription management...
          </p>
        </div>
      </div>
    );
  }

  if (!planInfo) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Invalid plan selected.</p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link href="/pricing">Back to Pricing</Link>
          </Button>
        </div>
      </div>
    );
  }

  const displayPrice =
    interval === "yearly" && planInfo.yearly !== null
      ? `$${planInfo.yearly}/year`
      : `$${planInfo.monthly}/month`;

  return (
    <div className="min-h-svh bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center gap-4 px-4 sm:px-6">
          <Button asChild variant="ghost" size="sm">
            <Link href="/pricing">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
          <div>
            <h1 className="text-sm font-semibold">
              Subscribe to {planInfo.name}
            </h1>
            <p className="text-xs text-muted-foreground">{displayPrice}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <EmbeddedCheckoutProvider
          stripe={stripePromise}
          options={{ fetchClientSecret }}
        >
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    </div>
  );
}
