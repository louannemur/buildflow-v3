import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { stripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id parameter" },
        { status: 400 },
      );
    }

    const checkoutSession =
      await stripe.checkout.sessions.retrieve(sessionId);

    // Verify the session belongs to this user
    if (checkoutSession.metadata?.userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If checkout is complete, eagerly sync subscription to avoid webhook race condition
    if (
      checkoutSession.status === "complete" &&
      checkoutSession.mode === "subscription" &&
      checkoutSession.subscription
    ) {
      const stripeSubscriptionId =
        typeof checkoutSession.subscription === "string"
          ? checkoutSession.subscription
          : checkoutSession.subscription.id;

      const stripeCustomerId =
        typeof checkoutSession.customer === "string"
          ? checkoutSession.customer
          : checkoutSession.customer?.id;

      const planName = checkoutSession.metadata?.planName ?? "free";

      // Retrieve the full subscription for period dates
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const subItem = stripeSub.items.data[0];
      const stripePriceId = subItem?.price?.id ?? null;

      await db
        .update(subscriptions)
        .set({
          stripeCustomerId: stripeCustomerId ?? null,
          stripeSubscriptionId,
          stripePriceId,
          plan: planName as "free" | "studio" | "pro" | "founding",
          status: "active",
          currentPeriodStart: subItem
            ? new Date(subItem.current_period_start * 1000)
            : null,
          currentPeriodEnd: subItem
            ? new Date(subItem.current_period_end * 1000)
            : null,
          cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        })
        .where(eq(subscriptions.userId, session.user.id));
    }

    return NextResponse.json({
      status: checkoutSession.status,
      customerEmail:
        typeof checkoutSession.customer_details?.email === "string"
          ? checkoutSession.customer_details.email
          : null,
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
