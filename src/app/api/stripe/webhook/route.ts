import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { getPlanFromPriceId } from "@/lib/stripe/config";
import type Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headersList = await headers();
  const signature = headersList.get("Stripe-Signature");

  if (!signature) {
    return new NextResponse("Missing Stripe signature", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Webhook Error: ${message}`, { status: 400 });
  }

  switch (event.type) {
    /* ─── Checkout completed ─────────────────────────────────────────── */
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.mode !== "subscription" || !session.subscription) break;

      const userId = session.metadata?.userId;
      if (!userId) break;

      const planName = session.metadata?.planName ?? "free";
      const stripeCustomerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
      const stripeSubscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      // Retrieve full subscription for period dates
      const stripeSub = await stripe.subscriptions.retrieve(
        stripeSubscriptionId!,
      );
      const subItem = stripeSub.items.data[0];
      const stripePriceId = subItem?.price?.id ?? null;

      await db
        .update(subscriptions)
        .set({
          stripeCustomerId: stripeCustomerId ?? null,
          stripeSubscriptionId: stripeSubscriptionId ?? null,
          stripePriceId,
          plan: planName as "free" | "studio" | "pro" | "founding",
          status: "active",
          currentPeriodStart: subItem ? new Date(subItem.current_period_start * 1000) : null,
          currentPeriodEnd: subItem ? new Date(subItem.current_period_end * 1000) : null,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        })
        .where(eq(subscriptions.userId, userId));

      break;
    }

    /* ─── Subscription updated ───────────────────────────────────────── */
    case "customer.subscription.updated": {
      const stripeSub = event.data.object as Stripe.Subscription;

      const userId = stripeSub.metadata?.userId;
      if (!userId) break;

      const subItem = stripeSub.items.data[0];
      const stripePriceId = subItem?.price?.id ?? null;
      const plan = stripePriceId ? getPlanFromPriceId(stripePriceId) : "free";

      let status: "active" | "canceled" | "past_due" | "trialing" = "active";
      if (stripeSub.status === "past_due") status = "past_due";
      else if (stripeSub.status === "canceled") status = "canceled";
      else if (stripeSub.status === "trialing") status = "trialing";

      await db
        .update(subscriptions)
        .set({
          stripePriceId,
          plan,
          status,
          currentPeriodStart: subItem ? new Date(subItem.current_period_start * 1000) : null,
          currentPeriodEnd: subItem ? new Date(subItem.current_period_end * 1000) : null,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        })
        .where(eq(subscriptions.userId, userId));

      break;
    }

    /* ─── Subscription deleted ───────────────────────────────────────── */
    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;

      const userId = stripeSub.metadata?.userId;
      if (!userId) break;

      await db
        .update(subscriptions)
        .set({
          plan: "free",
          status: "canceled",
          stripePriceId: null,
          stripeSubscriptionId: null,
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        })
        .where(eq(subscriptions.userId, userId));

      break;
    }

    /* ─── Payment failed ─────────────────────────────────────────────── */
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;

      const stripeCustomerId =
        typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

      if (!stripeCustomerId) break;

      // Look up user by Stripe customer ID
      const sub = await db.query.subscriptions.findFirst({
        where: eq(subscriptions.stripeCustomerId, stripeCustomerId),
        columns: { id: true },
      });

      if (!sub) break;

      await db
        .update(subscriptions)
        .set({ status: "past_due" })
        .where(eq(subscriptions.id, sub.id));

      break;
    }

    default:
      break;
  }

  return new NextResponse(null, { status: 200 });
}
