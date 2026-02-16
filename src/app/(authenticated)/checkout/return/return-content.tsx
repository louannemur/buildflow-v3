"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { CheckCircle, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type SessionStatus = "complete" | "open" | "expired" | null;

export function ReturnContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { update: updateSession } = useSession();
  const sessionId = searchParams.get("session_id");

  const [status, setStatus] = useState<SessionStatus>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) {
      setLoading(false);
      return;
    }

    async function checkStatus() {
      try {
        const res = await fetch(
          `/api/stripe/session-status?session_id=${sessionId}`,
        );
        const data = await res.json();

        if (res.ok) {
          setStatus(data.status);

          if (data.status === "complete") {
            await updateSession();
          }
        }
      } catch {
        // Will show error state
      } finally {
        setLoading(false);
      }
    }

    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Confirming your payment...
          </p>
        </div>
      </div>
    );
  }

  if (status === "complete") {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle className="size-12 text-success" />
          <div>
            <h1 className="text-xl font-semibold">Subscription activated!</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Welcome to your new plan. Your account has been upgraded.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild size="sm">
              <Link href="/home">Go to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/billing">View Billing</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "open") {
    router.replace("/checkout");
    return null;
  }

  return (
    <div className="flex min-h-svh items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <XCircle className="size-12 text-destructive" />
        <div>
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            We could not confirm your payment. Please try again.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/plans">Back to Pricing</Link>
        </Button>
      </div>
    </div>
  );
}
