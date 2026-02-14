export type PlanName = "free" | "studio" | "pro" | "founding";
export type BillingInterval = "monthly" | "yearly";

export interface PriceConfig {
  priceId: string;
  amount: number;
  interval: BillingInterval;
}

export interface PlanConfig {
  name: string;
  description: string;
  prices: Partial<Record<BillingInterval, PriceConfig>>;
}

export const STRIPE_PLANS: Record<PlanName, PlanConfig> = {
  free: {
    name: "Free",
    description: "Explore the design studio at your own pace",
    prices: {},
  },
  studio: {
    name: "Studio",
    description: "For individual creators and side projects",
    prices: {
      monthly: {
        priceId: process.env.STRIPE_STUDIO_MONTHLY_PRICE_ID ?? "",
        amount: 4.99,
        interval: "monthly",
      },
      yearly: {
        priceId: process.env.STRIPE_STUDIO_YEARLY_PRICE_ID ?? "",
        amount: 49.9,
        interval: "yearly",
      },
    },
  },
  pro: {
    name: "Pro",
    description: "For professional builders shipping real products",
    prices: {
      monthly: {
        priceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
        amount: 12.99,
        interval: "monthly",
      },
      yearly: {
        priceId: process.env.STRIPE_PRO_YEARLY_PRICE_ID ?? "",
        amount: 129.9,
        interval: "yearly",
      },
    },
  },
  founding: {
    name: "Founding Partner",
    description: "Help shape the product. Price locked forever.",
    prices: {
      monthly: {
        priceId: process.env.STRIPE_FOUNDING_MONTHLY_PRICE_ID ?? "",
        amount: 6.99,
        interval: "monthly",
      },
    },
  },
};

/**
 * Resolve a Stripe price ID back to a plan name.
 * Used by webhooks to determine which plan a subscription belongs to.
 */
export function getPlanFromPriceId(priceId: string): PlanName {
  for (const [planName, config] of Object.entries(STRIPE_PLANS)) {
    for (const price of Object.values(config.prices)) {
      if (price.priceId === priceId) {
        return planName as PlanName;
      }
    }
  }
  return "free";
}
