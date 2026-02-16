import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import type Stripe from "stripe";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const flow = body?.flow as string | undefined;
    const returnTo = body?.returnTo as string | undefined;

    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.userId, session.user.id),
      columns: { stripeCustomerId: true },
    });

    if (!sub?.stripeCustomerId) {
      return NextResponse.json(
        { error: "No billing account found. Subscribe to a plan first." },
        { status: 400 },
      );
    }

    const params: Stripe.BillingPortal.SessionCreateParams = {
      customer: sub.stripeCustomerId,
      return_url: returnTo
        ? `${process.env.NEXT_PUBLIC_APP_URL}${returnTo}`
        : `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
    };

    if (flow === "payment_method_update") {
      params.flow_data = {
        type: "payment_method_update",
      };
    }

    const portalSession = await stripe.billingPortal.sessions.create(params);

    return NextResponse.json({ url: portalSession.url });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
