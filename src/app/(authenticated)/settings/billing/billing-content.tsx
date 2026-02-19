"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Crown,
  Loader2,
  ExternalLink,
  Trash2,
  AlertTriangle,
  Sparkles,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface UsageData {
  subscription: {
    plan: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    cancelAtPeriodEnd: boolean;
  };
  usage: {
    designGenerations: number;
    projectTokensUsed: number;
    projectsCreated: number;
    designsSaved: number;
  };
  limits: {
    maxProjects: number;
    maxDesigns: number;
    maxDesignGenerationsPerDay: number;
    maxProjectTokensPerMonth: number;
  };
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  studio: "Studio",
  pro: "Pro",
  founding: "Founding Member",
};

const PLAN_PRICES: Record<string, string> = {
  free: "$0",
  studio: "$4.99",
  pro: "$12.99",
  founding: "$6.99",
};

function formatLimit(value: number): string {
  if (value === Infinity || value >= 999_999) return "Unlimited";
  return value.toLocaleString();
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000)
    return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000)
    return `${(tokens / 1_000).toFixed(tokens % 1_000 === 0 ? 0 : 1)}K`;
  return String(tokens);
}

function usagePercent(used: number, limit: number): number {
  if (limit === Infinity || limit >= 999_999) return 0;
  if (limit === 0) return used > 0 ? 100 : 0;
  return Math.min(Math.round((used / limit) * 100), 100);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Billing Content                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function BillingContent() {
  const { data: session, update: updateSession } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Detect checkout success and refresh session
  useEffect(() => {
    if (searchParams.get("success") === "true") {
      updateSession();
      toast.success("Subscription activated! Welcome to your new plan.");
      router.replace("/settings/billing");
    }
  }, [searchParams, updateSession, router]);

  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteDataOpen, setDeleteDataOpen] = useState(false);
  const [deleteDataConfirm, setDeleteDataConfirm] = useState("");
  const [deleteDataLoading, setDeleteDataLoading] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState("");
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);

  // ─── Fetch usage data ───────────────────────────────────────────────

  useEffect(() => {
    async function fetchUsage() {
      try {
        const res = await fetch("/api/users/me/usage");
        if (!res.ok) return;
        const json = await res.json();
        setData(json);
      } catch {
        toast.error("Failed to load billing data");
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, []);

  // ─── Stripe Portal ──────────────────────────────────────────────────

  const handleManageBilling = useCallback(async () => {
    if (portalLoading) return;
    setPortalLoading(true);

    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const json = await res.json();

      if (!res.ok) {
        toast.error(json.error ?? "Failed to open billing portal");
        return;
      }

      window.location.href = json.url;
    } catch {
      toast.error("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  }, [portalLoading]);

  // ─── Delete all data ────────────────────────────────────────────────

  const handleDeleteData = useCallback(async () => {
    if (deleteDataLoading) return;
    setDeleteDataLoading(true);

    try {
      const res = await fetch("/api/users/me/data", { method: "DELETE" });

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Failed to delete data");
        return;
      }

      toast.success("All projects and designs have been deleted");
      setDeleteDataOpen(false);
      setDeleteDataConfirm("");

      // Refresh usage data
      const usageRes = await fetch("/api/users/me/usage");
      if (usageRes.ok) {
        const json = await usageRes.json();
        setData(json);
      }
    } catch {
      toast.error("Failed to delete data");
    } finally {
      setDeleteDataLoading(false);
    }
  }, [deleteDataLoading]);

  // ─── Delete account ─────────────────────────────────────────────────

  const handleDeleteAccount = useCallback(async () => {
    if (deleteAccountLoading) return;
    setDeleteAccountLoading(true);

    try {
      const res = await fetch("/api/users/me", { method: "DELETE" });

      if (!res.ok) {
        const json = await res.json();
        toast.error(json.error ?? "Failed to delete account");
        return;
      }

      toast.success("Account deleted successfully");
      await signOut({ callbackUrl: "/" });
    } catch {
      toast.error("Failed to delete account");
    } finally {
      setDeleteAccountLoading(false);
    }
  }, [deleteAccountLoading]);

  // ─── Loading skeleton ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-1 h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load billing data. Please refresh the page.
      </p>
    );
  }

  const { subscription, usage: currentUsage, limits } = data;
  const plan = subscription.plan;
  const isFree = plan === "free";
  const isCanceling = subscription.cancelAtPeriodEnd;

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Account & Billing</h2>
        <p className="text-sm text-muted-foreground">
          Manage your subscription, billing, and account settings.
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="plan">
        <TabsList variant="line">
          <TabsTrigger value="plan">Plan</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        {/* ═══ Plan Tab ═══ */}
        <TabsContent value="plan" className="space-y-6 pt-4">
          {/* Current plan card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Crown className="size-4 text-amber-500" />
                  <CardTitle className="text-sm">Current Plan</CardTitle>
                </div>
                <Badge
                  variant={isFree ? "secondary" : "default"}
                  className={
                    !isFree
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                      : ""
                  }
                >
                  {PLAN_LABELS[plan] ?? plan}
                </Badge>
              </div>
              <CardDescription>
                {isFree
                  ? "You're on the free plan. Upgrade to unlock more features."
                  : isCanceling
                    ? `Your plan will be canceled on ${formatDate(subscription.currentPeriodEnd)}.`
                    : `${PLAN_PRICES[plan]}/month · Renews ${formatDate(subscription.currentPeriodEnd)}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                {isFree ? (
                  <Button asChild size="sm">
                    <Link href="/plans">
                      <Sparkles className="mr-1.5 size-3.5" />
                      Upgrade Plan
                    </Link>
                  </Button>
                ) : isCanceling ? (
                  <Button size="sm" onClick={handleManageBilling} disabled={portalLoading}>
                    {portalLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                    Reactivate Plan
                  </Button>
                ) : (
                  <>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/plans">
                        <ArrowUpRight className="mr-1.5 size-3.5" />
                        Change Plan
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground"
                      onClick={handleManageBilling}
                      disabled={portalLoading}
                    >
                      {portalLoading && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
                      Cancel Plan
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Usage card */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Zap className="size-4 text-blue-500" />
                <CardTitle className="text-sm">Usage This Month</CardTitle>
              </div>
              <CardDescription>
                Your resource usage for the current billing period.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Projects */}
              <UsageRow
                label="Projects"
                used={currentUsage.projectsCreated}
                limit={limits.maxProjects}
              />

              {/* Designs */}
              <UsageRow
                label="Designs"
                used={currentUsage.designsSaved}
                limit={limits.maxDesigns}
              />

              {/* Design Generations */}
              <UsageRow
                label="Design Generations (today)"
                used={currentUsage.designGenerations}
                limit={limits.maxDesignGenerationsPerDay}
              />

              {/* Project AI token usage: features, flows, pages, build */}
              <UsageRow
                label="Project Tokens"
                used={currentUsage.projectTokensUsed}
                limit={limits.maxProjectTokensPerMonth}
                formatValue={formatTokens}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ Billing Tab ═══ */}
        <TabsContent value="billing" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Billing Management</CardTitle>
              <CardDescription>
                {isFree
                  ? "Subscribe to a paid plan to access billing management."
                  : "View and manage your payment methods, billing address, and invoices through Stripe."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isFree ? (
                <Button asChild size="sm">
                  <Link href="/plans">
                    <Sparkles className="mr-1.5 size-3.5" />
                    View Plans
                  </Link>
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                >
                  {portalLoading && (
                    <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                  )}
                  <ExternalLink className="mr-1.5 size-3.5" />
                  Open Billing Portal
                </Button>
              )}
            </CardContent>
          </Card>

          {!isFree && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Billing Details</CardTitle>
                <CardDescription>
                  Your current billing cycle information.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-muted-foreground">Plan</dt>
                    <dd className="font-medium">
                      {PLAN_LABELS[plan] ?? plan} ({PLAN_PRICES[plan]}/mo)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className="font-medium capitalize">
                      {isCanceling ? "Canceling" : subscription.status}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Current Period</dt>
                    <dd className="font-medium">
                      {formatDate(subscription.currentPeriodStart)} –{" "}
                      {formatDate(subscription.currentPeriodEnd)}
                    </dd>
                  </div>
                  {isCanceling && (
                    <div>
                      <dt className="text-muted-foreground">Cancels On</dt>
                      <dd className="font-medium text-amber-600">
                        {formatDate(subscription.currentPeriodEnd)}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ Danger Zone Tab ═══ */}
        <TabsContent value="danger" className="space-y-6 pt-4">
          {/* Delete all data */}
          <Card className="border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <Trash2 className="size-4 text-destructive" />
                <CardTitle className="text-sm">
                  Delete All Projects & Designs
                </CardTitle>
              </div>
              <CardDescription>
                Permanently delete all your projects, designs, and saved
                components. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteDataOpen(true)}
              >
                <Trash2 className="mr-1.5 size-3.5" />
                Delete All Data
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Delete account */}
          <Card className="border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="size-4 text-destructive" />
                <CardTitle className="text-sm">Delete Account</CardTitle>
              </div>
              <CardDescription>
                Permanently delete your account, all data, and cancel any active
                subscriptions. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeleteAccountOpen(true)}
              >
                <AlertTriangle className="mr-1.5 size-3.5" />
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══ Delete Data Dialog ═══ */}
      <AlertDialog open={deleteDataOpen} onOpenChange={setDeleteDataOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete all projects & designs?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your projects, designs, saved
              components, and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Type <span className="font-mono text-destructive">DELETE</span> to
              confirm:
            </p>
            <Input
              value={deleteDataConfirm}
              onChange={(e) => setDeleteDataConfirm(e.target.value)}
              placeholder="DELETE"
              className="font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteDataConfirm("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                deleteDataConfirm !== "DELETE" || deleteDataLoading
              }
              onClick={(e) => {
                e.preventDefault();
                handleDeleteData();
              }}
            >
              {deleteDataLoading && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              Delete All Data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ Delete Account Dialog ═══ */}
      <AlertDialog
        open={deleteAccountOpen}
        onOpenChange={setDeleteAccountOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your account, all data, and cancel any
              active subscriptions. You will be signed out immediately. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Type your email{" "}
              <span className="font-mono text-destructive">
                {session?.user?.email}
              </span>{" "}
              to confirm:
            </p>
            <Input
              value={deleteAccountConfirm}
              onChange={(e) => setDeleteAccountConfirm(e.target.value)}
              placeholder={session?.user?.email ?? "your@email.com"}
              className="font-mono"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteAccountConfirm("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={
                deleteAccountConfirm !== session?.user?.email ||
                deleteAccountLoading
              }
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAccount();
              }}
            >
              {deleteAccountLoading && (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              )}
              Delete Account Forever
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Usage Row ──────────────────────────────────────────────────────────── */

function UsageRow({
  label,
  used,
  limit,
  formatValue,
}: {
  label: string;
  used: number;
  limit: number;
  formatValue?: (n: number) => string;
}) {
  const percent = usagePercent(used, limit);
  const isUnlimited = limit === Infinity || limit >= 999_999;
  const isOverLimit = !isUnlimited && limit > 0 && used >= limit;
  const fmt = formatValue ?? ((n: number) => n.toLocaleString());

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={isOverLimit ? "font-medium text-destructive" : "font-medium"}>
          {fmt(used)}
          {!isUnlimited && (
            <span className="text-muted-foreground"> / {formatValue ? formatValue(limit) : formatLimit(limit)}</span>
          )}
          {isUnlimited && (
            <span className="ml-1 text-xs text-muted-foreground">
              (Unlimited)
            </span>
          )}
        </span>
      </div>
      {!isUnlimited && limit > 0 && (
        <Progress
          value={percent}
          className={isOverLimit ? "[&>[data-slot=progress-indicator]]:bg-destructive" : ""}
        />
      )}
    </div>
  );
}
