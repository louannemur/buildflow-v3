"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Check, X, ArrowRight, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useCurrentUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

/* ─── Animation helpers ──────────────────────────────────────────────────── */

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.4, 0, 1] as [number, number, number, number],
    },
  },
};

/* ─── Tier data ──────────────────────────────────────────────────────────── */

type PlanKey = "free" | "studio" | "pro" | "founding";

const tierOrder: PlanKey[] = ["free", "studio", "pro", "founding"];

interface Tier {
  key: PlanKey;
  name: string;
  monthlyPrice: number;
  description: string;
  badge?: { label: string; variant: "primary" | "warning" };
  cta: string;
  features: { label: string; included: boolean }[];
}

const tiers: Tier[] = [
  {
    key: "free",
    name: "Free",
    monthlyPrice: 0,
    description: "Explore the design studio at your own pace",
    cta: "Get Started",
    features: [
      { label: "3 design generations per day", included: true },
      { label: "3 saved designs total", included: true },
      { label: "Basic design editing", included: true },
      { label: "Watermark on output", included: true },
      { label: "Projects", included: false },
      { label: "Code view mode", included: false },
      { label: "AI project generation", included: false },
      { label: "Build & export", included: false },
    ],
  },
  {
    key: "studio",
    name: "Studio",
    monthlyPrice: 4.99,
    description: "For individual creators and side projects",
    cta: "Start Studio",
    features: [
      { label: "30 design generations per day", included: true },
      { label: "Unlimited saved designs", included: true },
      { label: "Full design + code view mode", included: true },
      { label: "No watermark", included: true },
      { label: "1 project (5 pages max)", included: true },
      { label: "10 AI generations / month", included: true },
      { label: "Build & export", included: false },
      { label: "Priority AI", included: false },
    ],
  },
  {
    key: "pro",
    name: "Pro",
    monthlyPrice: 12.99,
    description: "For professional builders shipping real products",
    badge: { label: "Most Popular", variant: "primary" },
    cta: "Go Pro",
    features: [
      { label: "Unlimited design generations", included: true },
      { label: "Unlimited saved designs", included: true },
      { label: "Full design + code editing", included: true },
      { label: "No watermark", included: true },
      { label: "10 projects", included: true },
      { label: "200 AI generations / month", included: true },
      { label: "Full build & export", included: true },
      { label: "Priority AI", included: true },
    ],
  },
  {
    key: "founding",
    name: "Founding Partner",
    monthlyPrice: 6.99,
    description: "Help shape the product. Price locked forever.",
    badge: { label: "Limited", variant: "warning" },
    cta: "Claim Your Spot",
    features: [
      { label: "Everything in Pro", included: true },
      { label: "Price locked forever", included: true },
      { label: "Founding member badge", included: true },
      { label: "Early access to new features", included: true },
      { label: "Direct feedback channel", included: true },
      { label: "Limited availability", included: true },
    ],
  },
];

/* ─── FAQ data ───────────────────────────────────────────────────────────── */

const faqs = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes. You can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated difference immediately. When downgrading, the change takes effect at your next billing cycle.",
  },
  {
    question: "What counts as an AI generation?",
    answer:
      "An AI generation is any time the AI creates or regenerates content for you within a project — features, user flows, page content, or designs. Design generations in the standalone Design Studio have their own separate daily limits.",
  },
  {
    question: "Is the Founding Partner price really locked forever?",
    answer:
      "Yes. As long as your subscription remains active, you'll keep the $6.99/month (or $58.30/year) price even as we add more features and raise prices for new subscribers. This is our thank-you for early supporters.",
  },
  {
    question: "What frameworks can I export to?",
    answer:
      "Pro and Founding plans support export to React, Next.js, Vue, and plain HTML/CSS. Studio plans can export individual designs as HTML/CSS. We're working on adding Svelte and Astro support.",
  },
  {
    question: "Do I need a credit card to start?",
    answer:
      "No. The Free plan requires no credit card and never expires. You only need payment information when you decide to upgrade to a paid plan.",
  },
  {
    question: "What happens to my projects if I downgrade?",
    answer:
      "Your projects and designs are never deleted. If you exceed the limits of your new plan, you won't be able to create new projects or designs until you're within limits, but everything you've already created stays accessible.",
  },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function formatPrice(monthly: number, yearly: boolean) {
  if (monthly === 0) return { amount: "$0", period: "forever" };
  if (yearly) {
    const yearlyTotal = monthly * 10; // 2 months free
    const perMonth = yearlyTotal / 12;
    return {
      amount: `$${perMonth % 1 === 0 ? perMonth.toFixed(0) : perMonth.toFixed(2)}`,
      period: "/month",
      billed: `$${yearlyTotal % 1 === 0 ? yearlyTotal.toFixed(0) : yearlyTotal.toFixed(2)}/year`,
    };
  }
  return {
    amount: `$${monthly % 1 === 0 ? monthly.toFixed(0) : monthly.toFixed(2)}`,
    period: "/month",
  };
}

function getCtaState(
  tierKey: PlanKey,
  currentPlan: PlanKey | undefined
): { label: string; variant: "default" | "outline" | "secondary"; disabled: boolean } {
  if (!currentPlan) {
    // Not authenticated — show default CTAs
    const tier = tiers.find((t) => t.key === tierKey)!;
    return { label: tier.cta, variant: tierKey === "pro" ? "default" : "outline", disabled: false };
  }

  if (tierKey === currentPlan) {
    return { label: "Current Plan", variant: "secondary", disabled: true };
  }

  const currentIdx = tierOrder.indexOf(currentPlan);
  const tierIdx = tierOrder.indexOf(tierKey);

  // Founding is special — it's idx 3 but priced lower than pro (idx 2)
  // Treat it as upgrade-equivalent to pro
  if (tierIdx > currentIdx) {
    return { label: "Upgrade", variant: "default", disabled: false };
  }
  return { label: "Downgrade", variant: "outline", disabled: false };
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Pricing content                                                          */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function PricingContent() {
  const [yearly, setYearly] = useState(false);
  const router = useRouter();
  const { user, isAuthenticated } = useCurrentUser();
  const currentPlan = isAuthenticated ? (user?.plan ?? "free") : undefined;

  function handleCheckout(planKey: PlanKey) {
    if (!isAuthenticated) {
      router.push("/signup");
      return;
    }

    if (planKey === "free" || planKey === currentPlan) return;

    const interval = yearly ? "yearly" : "monthly";
    router.push(`/checkout?plan=${planKey}&interval=${interval}`);
  }

  return (
    <div className="relative">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--color-brand-muted),transparent)]" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="pb-12 pt-16 text-center sm:pt-20"
        >
          <motion.p
            variants={staggerItem}
            className="text-sm font-medium uppercase tracking-widest text-primary"
          >
            Pricing
          </motion.p>
          <motion.h1
            variants={staggerItem}
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl"
          >
            Simple pricing,{" "}
            <span className="text-muted-foreground">no surprises</span>
          </motion.h1>
          <motion.p
            variants={staggerItem}
            className="mx-auto mt-4 max-w-xl text-muted-foreground"
          >
            Start free. Upgrade when your projects grow. Every plan includes
            access to the Design Studio.
          </motion.p>

          {/* Billing toggle */}
          <motion.div
            variants={staggerItem}
            className="mt-8 inline-flex items-center gap-3"
          >
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                !yearly ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Monthly
            </span>
            <button
              onClick={() => setYearly(!yearly)}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-border/60 transition-colors",
                yearly ? "bg-primary" : "bg-muted"
              )}
              role="switch"
              aria-checked={yearly}
              aria-label="Toggle yearly billing"
            >
              <span
                className={cn(
                  "pointer-events-none block size-4 rounded-full bg-white shadow-sm transition-transform",
                  yearly ? "translate-x-[22px]" : "translate-x-1"
                )}
              />
            </button>
            <span
              className={cn(
                "text-sm font-medium transition-colors",
                yearly ? "text-foreground" : "text-muted-foreground"
              )}
            >
              Yearly
            </span>
            {yearly && (
              <motion.span
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
              >
                2 months free
              </motion.span>
            )}
          </motion.div>
        </motion.div>

        {/* ── Tier cards ─────────────────────────────────────────────────── */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4"
        >
          {tiers.map((tier) => {
            const price = formatPrice(tier.monthlyPrice, yearly);
            const cta = getCtaState(tier.key, currentPlan);
            const isPro = tier.key === "pro";

            return (
              <motion.div
                key={tier.key}
                variants={staggerItem}
                className={cn(
                  "relative flex flex-col rounded-xl border p-6 transition-colors",
                  isPro
                    ? "border-primary/40 bg-primary/[0.03] shadow-lg shadow-primary/[0.06]"
                    : "border-border/50 bg-card/80"
                )}
              >
                {/* Badge */}
                {tier.badge && (
                  <div
                    className={cn(
                      "absolute -top-2.5 left-4 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold",
                      tier.badge.variant === "primary"
                        ? "bg-primary text-primary-foreground"
                        : "bg-warning text-warning-foreground"
                    )}
                  >
                    {tier.badge.variant === "primary" ? (
                      <Sparkles className="size-2.5" />
                    ) : (
                      <Clock className="size-2.5" />
                    )}
                    {tier.badge.label}
                  </div>
                )}

                {/* Plan name */}
                <h3 className="text-sm font-semibold">{tier.name}</h3>

                {/* Price */}
                <div className="mt-3 flex items-baseline gap-1">
                  <motion.span
                    key={`${tier.key}-${yearly}`}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                    className="text-3xl font-bold tracking-tight"
                  >
                    {price.amount}
                  </motion.span>
                  <span className="text-sm text-muted-foreground">
                    {price.period}
                  </span>
                </div>
                {price.billed && (
                  <motion.p
                    key={`${tier.key}-billed-${yearly}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-0.5 text-xs text-muted-foreground"
                  >
                    Billed {price.billed}
                  </motion.p>
                )}

                <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                  {tier.description}
                </p>

                {/* CTA */}
                <div className="mt-5">
                  {!isAuthenticated && tier.key === "free" ? (
                    <Button
                      variant={cta.variant}
                      size="sm"
                      className="w-full"
                      asChild
                    >
                      <Link href="/signup">
                        {cta.label}
                        <ArrowRight className="size-3.5" />
                      </Link>
                    </Button>
                  ) : (
                    <Button
                      variant={cta.variant}
                      size="sm"
                      className="w-full"
                      disabled={cta.disabled}
                      onClick={() => handleCheckout(tier.key)}
                    >
                      {cta.label}
                      {!cta.disabled && <ArrowRight className="size-3.5" />}
                    </Button>
                  )}
                </div>

                {/* Divider */}
                <div className="my-5 h-px bg-border/60" />

                {/* Features */}
                <ul className="flex-1 space-y-2">
                  {tier.features.map((f) => (
                    <li
                      key={f.label}
                      className="flex items-start gap-2 text-xs"
                    >
                      {f.included ? (
                        <Check className="mt-px size-3.5 shrink-0 text-success" />
                      ) : (
                        <X className="mt-px size-3.5 shrink-0 text-muted-foreground/40" />
                      )}
                      <span
                        className={
                          f.included
                            ? "text-foreground"
                            : "text-muted-foreground/60"
                        }
                      >
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </motion.div>

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={staggerContainer}
          className="mx-auto max-w-2xl pb-24 lg:pb-32"
        >
          <motion.div variants={staggerItem} className="text-center">
            <p className="text-sm font-medium uppercase tracking-widest text-primary">
              FAQ
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Common questions
            </h2>
          </motion.div>

          <motion.div variants={staggerItem} className="mt-10">
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}
