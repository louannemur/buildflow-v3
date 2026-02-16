import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import { STRIPE_PLANS, type PlanName, type BillingInterval } from "@/lib/stripe/config";

const updatePlanSchema = z.object({
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
    const parsed = updatePlanSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { planName, interval } = parsed.data;

    const planConfig = STRIPE_PLANS[planName as PlanName];
    const priceConfig = planConfig.prices[interval as BillingInterval];

    if (!priceConfig?.priceId) {
      return NextResponse.json(
        { error: "This billing interval is not available for the selected plan." },
        { status: 400 },
      );
    }

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, session.user.id),
      columns: { stripeSubscriptionId: true },
    });

    if (!sub?.stripeSubscriptionId) {
      return NextResponse.json(
        { error: "No active subscription found." },
        { status: 400 },
      );
    }

    const subscription = await stripe.subscriptions.retrieve(
      sub.stripeSubscriptionId,
    );

    if (!subscription.items.data[0]) {
      return NextResponse.json(
        { error: "Subscription has no items." },
        { status: 400 },
      );
    }

    // If subscription was set to cancel, undo that first
    if (subscription.cancel_at_period_end) {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: false,
      });
    }

    // Update the subscription to the new price
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: priceConfig.priceId,
        },
      ],
      proration_behavior: "create_prorations",
      metadata: {
        userId: session.user.id,
        planName,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update plan. Please try again." },
      { status: 500 },
    );
  }
}
