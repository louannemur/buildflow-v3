import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions } from "@/lib/db/schema";
import { stripe } from "@/lib/stripe";
import { STRIPE_PLANS, type PlanName, type BillingInterval } from "@/lib/stripe/config";

const previewSchema = z.object({
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
    const parsed = previewSchema.safeParse(body);

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

    // Get upcoming invoice preview with the plan change
    const upcomingInvoice = await stripe.invoices.createPreview({
      customer: subscription.customer as string,
      subscription: sub.stripeSubscriptionId,
      subscription_details: {
        items: [
          {
            id: subscription.items.data[0].id,
            price: priceConfig.priceId,
          },
        ],
        proration_behavior: "create_prorations",
      },
    });

    // Calculate proration amount (what they'll be charged/credited now)
    const prorationAmount = upcomingInvoice.lines.data
      .filter((line) => {
        const parent = line.parent;
        return (
          parent?.invoice_item_details?.proration ||
          parent?.subscription_item_details?.proration
        );
      })
      .reduce((sum, line) => sum + line.amount, 0);

    // Fetch default payment method for display
    // Check subscription → customer invoice_settings → customer default_source
    let paymentMethod: { brand: string; last4: string } | null = null;
    let pmId: string | null = null;

    const subPm = subscription.default_payment_method;
    if (subPm) {
      pmId = typeof subPm === "string" ? subPm : subPm.id;
    }

    if (!pmId) {
      const customerId = typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer.id;
      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer && !customer.deleted) {
          const invoicePm = customer.invoice_settings?.default_payment_method;
          if (invoicePm) {
            pmId = typeof invoicePm === "string" ? invoicePm : invoicePm.id;
          }
        }
      } catch {
        // Not critical
      }
    }

    if (pmId) {
      try {
        const pm = await stripe.paymentMethods.retrieve(pmId);
        if (pm.card) {
          paymentMethod = { brand: pm.card.brand, last4: pm.card.last4 };
        }
      } catch {
        // Not critical — modal will just hide the card info
      }
    }

    return NextResponse.json({
      planName: planConfig.name,
      newPrice: priceConfig.amount,
      interval,
      prorationAmount: prorationAmount / 100, // Convert cents to dollars
      immediateCharge: Math.max(prorationAmount / 100, 0),
      nextBillingDate: new Date(
        (upcomingInvoice.period_end ?? 0) * 1000,
      ).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      paymentMethod,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to preview upgrade. Please try again." },
      { status: 500 },
    );
  }
}
