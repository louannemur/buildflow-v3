import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";
import { STRIPE_PLANS, type PlanName, type BillingInterval } from "@/lib/stripe/config";

const checkoutSchema = z.object({
  planName: z.enum(["studio", "pro", "founding"]),
  interval: z.enum(["monthly", "yearly"]),
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { planName, interval } = parsed.data;
    const userId = session.user.id;

    // Resolve price ID from config
    const planConfig = STRIPE_PLANS[planName as PlanName];
    const priceConfig = planConfig.prices[interval as BillingInterval];

    if (!priceConfig?.priceId) {
      return NextResponse.json(
        { error: "This billing interval is not available for the selected plan." },
        { status: 400 },
      );
    }

    // Check if user already has an active Stripe subscription
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, userId),
      columns: { stripeCustomerId: true, stripeSubscriptionId: true },
    });

    if (sub?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "You already have an active subscription. Use the billing portal to change plans." },
        { status: 400 },
      );
    }

    // Build checkout session (embedded mode)
    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      ui_mode: "embedded",
      line_items: [{ price: priceConfig.priceId, quantity: 1 }],
      allow_promotion_codes: true,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      metadata: {
        userId,
        planName,
      },
      subscription_data: {
        metadata: {
          userId,
          planName,
        },
      },
    };

    // Reuse existing Stripe customer if available
    if (sub?.stripeCustomerId) {
      checkoutParams.customer = sub.stripeCustomerId;
    } else {
      checkoutParams.customer_email = session.user.email ?? undefined;
    }

    const checkoutSession = await stripe.checkout.sessions.create(checkoutParams);

    return NextResponse.json({ clientSecret: checkoutSession.client_secret });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
