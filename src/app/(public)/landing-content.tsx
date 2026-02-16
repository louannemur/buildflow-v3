"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  Lightbulb,
  GitBranch,
  FileText,
  Palette,
  Hammer,
  Sparkles,
  Code2,
  Layers,
  Paintbrush,
  Blocks,
  Zap,
  Shield,
  ArrowRight,
  Check,
  Github,
  Twitter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ─── Animation helpers ──────────────────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.25, 0.4, 0, 1] as [number, number, number, number] },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: [0.25, 0.4, 0, 1] as [number, number, number, number] },
  },
};

/* ─── Section wrapper ────────────────────────────────────────────────────── */

function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("relative px-4 sm:px-6", className)}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

/* ─── Hero mock visual ───────────────────────────────────────────────────── */

function HeroVisual() {
  return (
    <div className="relative mx-auto mt-16 max-w-4xl sm:mt-20">
      {/* Glow behind */}
      <div className="pointer-events-none absolute -inset-8 rounded-3xl bg-gradient-to-b from-brand/20 via-violet/10 to-transparent blur-3xl" />

      {/* Browser frame */}
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-2xl shadow-black/[0.08] dark:shadow-black/[0.4]">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-border/50 bg-muted/50 px-4 py-2.5">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-red-400/80" />
            <div className="size-2.5 rounded-full bg-yellow-400/80" />
            <div className="size-2.5 rounded-full bg-green-400/80" />
          </div>
          <div className="ml-4 flex-1 rounded-md bg-background/60 px-3 py-1 text-center text-[11px] text-muted-foreground">
            calypso.app/project/my-saas
          </div>
        </div>

        {/* App content */}
        <div className="flex h-[320px] sm:h-[380px]">
          {/* Sidebar mock */}
          <div className="hidden w-48 shrink-0 border-r border-border/40 bg-sidebar p-3 sm:block">
            <div className="mb-4 h-5 w-24 rounded bg-foreground/10" />
            <div className="space-y-1">
              {[
                { label: "Features", active: false },
                { label: "User Flows", active: false },
                { label: "Pages", active: true },
                { label: "Designs", active: false },
                { label: "Build", active: false },
              ].map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium",
                    item.active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-1 border-t border-border/40 pt-3">
              <div className="h-3 w-20 rounded bg-muted-foreground/10" />
              <div className="h-3 w-28 rounded bg-muted-foreground/10" />
              <div className="h-3 w-16 rounded bg-muted-foreground/10" />
            </div>
          </div>

          {/* Main area */}
          <div className="flex-1 p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-5 w-32 rounded bg-foreground/10" />
              <div className="ml-auto h-7 w-20 rounded-md bg-primary/20" />
            </div>
            {/* Cards grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { w: "w-full", h: "h-28", accent: "border-primary/30" },
                { w: "w-full", h: "h-28", accent: "border-violet/30" },
                { w: "w-full", h: "h-28", accent: "border-success/30" },
                { w: "w-full", h: "h-20", accent: "border-border/40" },
                { w: "w-full", h: "h-20", accent: "border-border/40" },
                { w: "w-full", h: "h-20", accent: "border-border/40" },
              ].map((card, i) => (
                <div
                  key={i}
                  className={cn(
                    "rounded-lg border bg-background/60 p-3",
                    card.h,
                    card.accent
                  )}
                >
                  <div className="h-2.5 w-3/4 rounded bg-foreground/8" />
                  <div className="mt-2 h-2 w-1/2 rounded bg-muted-foreground/8" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Workflow steps ─────────────────────────────────────────────────────── */

const workflowSteps = [
  {
    icon: Lightbulb,
    title: "Define Features",
    description: "Describe your idea. AI generates a structured feature set you can refine.",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  {
    icon: GitBranch,
    title: "Map User Flows",
    description: "AI creates step-by-step user journeys for every feature automatically.",
    color: "text-violet",
    bg: "bg-violet/10",
  },
  {
    icon: FileText,
    title: "Generate Pages",
    description: "Pages, layouts, and content structure — all generated from your flows.",
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    icon: Palette,
    title: "Design Visually",
    description: "A visual editor generates production-quality designs for every page.",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    icon: Hammer,
    title: "Build & Export",
    description: "Export clean, framework-ready code. React, Next.js, Vue — your choice.",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
];

/* ─── Feature cards ──────────────────────────────────────────────────────── */

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Generation",
    description:
      "Every step is assisted by AI — from ideation to pixel-perfect designs and production code.",
  },
  {
    icon: Paintbrush,
    title: "Visual Design Editor",
    description:
      "A real-time canvas for designing pages visually. No Figma export needed.",
  },
  {
    icon: Code2,
    title: "Clean Code Export",
    description:
      "Export framework-ready code in React, Next.js, or Vue with proper component structure.",
  },
  {
    icon: Layers,
    title: "Multi-Framework Output",
    description:
      "Target React, Next.js, Vue, or plain HTML. Same design, any stack.",
  },
  {
    icon: Blocks,
    title: "Component System",
    description:
      "Save and reuse components across projects. Build your own design system over time.",
  },
  {
    icon: Zap,
    title: "Instant Prototyping",
    description:
      "Go from idea to interactive prototype in minutes, not days.",
  },
  {
    icon: Shield,
    title: "Style Guide Sync",
    description:
      "Colors, typography, and spacing stay consistent across every generated page.",
  },
  {
    icon: GitBranch,
    title: "Version History",
    description:
      "Every design iteration is versioned. Compare, revert, or branch at any point.",
  },
];

/* ─── Pricing tiers ──────────────────────────────────────────────────────── */

const pricingTiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Explore the design studio",
    features: ["3 design generations / day", "3 saved designs", "Basic design editing"],
  },
  {
    name: "Studio",
    price: "$4.99",
    period: "/month",
    description: "For individual creators",
    features: ["30 design generations / day", "Unlimited saved designs", "1 project (5 pages)", "Code view mode"],
    highlight: false,
  },
  {
    name: "Pro",
    price: "$12.99",
    period: "/month",
    description: "For professional builders",
    features: [
      "Unlimited design generations",
      "15 projects",
      "200 AI generations / month",
      "Full build & export",
      "Code editing",
    ],
    highlight: true,
  },
  {
    name: "Founding",
    price: "$6.99",
    period: "/month",
    description: "Same as Pro, discounted price locked forever",
    features: [
      "Same as Pro",
      "Discounted price locked forever",
      "Early access to features",
      "Founding member badge",
    ],
  },
];

/* ─── Design Studio section visual ───────────────────────────────────────── */

function StudioVisual() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-2xl bg-gradient-to-tr from-violet/15 via-primary/10 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl shadow-black/[0.06] dark:shadow-black/[0.3]">
        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
          <div className="flex gap-1">
            {["bg-primary/60", "bg-violet/60", "bg-muted-foreground/30", "bg-muted-foreground/30"].map(
              (c, i) => (
                <div key={i} className={cn("size-6 rounded-md", c)} />
              )
            )}
          </div>
          <div className="mx-3 h-5 w-px bg-border/60" />
          <div className="h-3 w-16 rounded bg-foreground/8" />
          <div className="ml-auto flex gap-1.5">
            <div className="h-6 w-14 rounded-md bg-primary/15 text-center text-[10px] font-medium leading-6 text-primary">
              Export
            </div>
          </div>
        </div>
        {/* Canvas */}
        <div className="flex h-[260px] sm:h-[300px]">
          {/* Layers panel */}
          <div className="hidden w-40 shrink-0 border-r border-border/30 p-2.5 sm:block">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
              Layers
            </div>
            <div className="space-y-1">
              {["Hero Section", "Nav Bar", "Feature Card", "CTA Button", "Footer"].map(
                (name, i) => (
                  <div
                    key={name}
                    className={cn(
                      "rounded px-2 py-1 text-[11px]",
                      i === 0
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {name}
                  </div>
                )
              )}
            </div>
          </div>
          {/* Canvas area */}
          <div className="flex-1 bg-[repeating-conic-gradient(var(--color-muted)_0%_25%,transparent_0%_50%)] bg-[length:16px_16px] p-4">
            <div className="mx-auto flex h-full max-w-sm flex-col items-center justify-center rounded-lg border border-dashed border-primary/40 bg-background/80 p-6 backdrop-blur-sm">
              <div className="mb-3 h-5 w-40 rounded bg-foreground/12" />
              <div className="mb-1 h-3 w-56 rounded bg-muted-foreground/10" />
              <div className="mb-4 h-3 w-44 rounded bg-muted-foreground/10" />
              <div className="flex gap-2">
                <div className="h-7 w-20 rounded-md bg-primary" />
                <div className="h-7 w-20 rounded-md border border-border bg-background" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Landing page                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function LandingContent() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div ref={heroRef} className="relative overflow-hidden">
        {/* Background gradients */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--color-brand-muted),transparent)]" />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_50%,var(--color-violet)_0%,transparent_50%)] opacity-[0.07]" />

        <Section className="pb-24 pt-20 sm:pb-32 sm:pt-28 lg:pt-36">
          <motion.div
            style={{ y: heroY, opacity: heroOpacity }}
            className="text-center"
          >
            <motion.div
              initial="hidden"
              animate="visible"
              variants={staggerContainer}
            >
              {/* Badge */}
              <motion.div variants={staggerItem} className="mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3.5 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-success" />
                </span>
                Now in public beta
              </motion.div>

              {/* Headline */}
              <motion.h1
                variants={staggerItem}
                className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl"
              >
                From rough idea to{" "}
                <span className="bg-gradient-to-r from-primary via-violet to-primary bg-clip-text text-transparent">
                  production-ready app
                </span>
              </motion.h1>

              {/* Subheadline */}
              <motion.p
                variants={staggerItem}
                className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg sm:leading-relaxed"
              >
                Calypso turns your ideas into features, user flows, pages,
                pixel-perfect designs, and clean code — all with AI, all in one
                place.
              </motion.p>

              {/* CTAs */}
              <motion.div
                variants={staggerItem}
                className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4"
              >
                <Button size="lg" className="w-full sm:w-auto" asChild>
                  <Link href="/signup">
                    Start Building Free
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full sm:w-auto"
                  asChild
                >
                  <Link href="#how-it-works">See How It Works</Link>
                </Button>
              </motion.div>
            </motion.div>
          </motion.div>

          {/* Hero visual */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.4,
              ease: [0.25, 0.4, 0, 1] as [number, number, number, number],
            }}
          >
            <HeroVisual />
          </motion.div>
        </Section>
      </div>

      {/* ── How It Works ─────────────────────────────────────────────────── */}
      <Section id="how-it-works" className="py-24 lg:py-32">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="text-center"
        >
          <motion.p
            variants={staggerItem}
            className="text-sm font-medium uppercase tracking-widest text-primary"
          >
            How It Works
          </motion.p>
          <motion.h2
            variants={staggerItem}
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Five steps. One workflow.
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="mx-auto mt-4 max-w-xl text-muted-foreground"
          >
            Each step builds on the last. AI handles the heavy lifting — you
            stay in control.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-60px" }}
          variants={staggerContainer}
          className="relative mt-16 grid gap-6 sm:mt-20 md:grid-cols-5"
        >
          {/* Connecting line (desktop) */}
          <div className="pointer-events-none absolute top-10 right-[10%] left-[10%] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />

          {workflowSteps.map((step) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                variants={staggerItem}
                className="relative flex flex-col items-center text-center"
              >
                <div
                  className={cn(
                    "relative z-10 flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-card shadow-sm sm:size-20",
                    step.bg
                  )}
                >
                  <Icon className={cn("size-7 sm:size-8", step.color)} />
                </div>
                <h3 className="mt-4 text-sm font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </motion.div>
      </Section>

      {/* ── Design Studio ────────────────────────────────────────────────── */}
      <Section className="py-24 lg:py-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
          >
            <motion.p
              variants={staggerItem}
              className="text-sm font-medium uppercase tracking-widest text-violet"
            >
              Design Studio
            </motion.p>
            <motion.h2
              variants={staggerItem}
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Design stunning pages{" "}
              <span className="text-muted-foreground">in&nbsp;seconds</span>
            </motion.h2>
            <motion.p
              variants={staggerItem}
              className="mt-4 max-w-lg text-muted-foreground leading-relaxed"
            >
              The Design Studio works as a standalone tool too. Describe what you
              want, refine visually, and export production-ready code — without
              touching the full project workflow.
            </motion.p>
            <motion.ul
              variants={staggerContainer}
              className="mt-6 space-y-2.5"
            >
              {[
                "AI-generated layouts from a text prompt",
                "Real-time visual editing on canvas",
                "Export to React, HTML, or Tailwind",
                "Reusable component library",
              ].map((item) => (
                <motion.li
                  key={item}
                  variants={staggerItem}
                  className="flex items-center gap-2.5 text-sm"
                >
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-violet/10">
                    <Check className="size-3 text-violet" />
                  </div>
                  {item}
                </motion.li>
              ))}
            </motion.ul>
            <motion.div variants={staggerItem} className="mt-8">
              <Button variant="outline" asChild>
                <Link href="/signup">
                  Try the Design Studio
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </motion.div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.7,
              ease: [0.25, 0.4, 0, 1] as [number, number, number, number],
            }}
          >
            <StudioVisual />
          </motion.div>
        </div>
      </Section>

      {/* ── Features Grid ────────────────────────────────────────────────── */}
      <Section id="features" className="py-24 lg:py-32">
        <div className="relative">
          {/* Subtle background glow */}
          <div className="pointer-events-none absolute inset-0 -mx-8 rounded-3xl bg-[radial-gradient(ellipse_at_center,var(--color-brand-muted)_0%,transparent_70%)] opacity-40" />

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            variants={staggerContainer}
            className="relative text-center"
          >
            <motion.p
              variants={staggerItem}
              className="text-sm font-medium uppercase tracking-widest text-primary"
            >
              Features
            </motion.p>
            <motion.h2
              variants={staggerItem}
              className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              Everything you need to ship
            </motion.h2>
            <motion.p
              variants={staggerItem}
              className="mx-auto mt-4 max-w-xl text-muted-foreground"
            >
              A complete toolkit for going from concept to code, powered by AI
              at every step.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-40px" }}
            variants={staggerContainer}
            className="relative mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  variants={staggerItem}
                  className="group rounded-xl border border-border/50 bg-card/70 p-5 backdrop-blur-sm transition-colors hover:border-border hover:bg-card"
                >
                  <div className="mb-3 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    <Icon className="size-4.5" />
                  </div>
                  <h3 className="text-sm font-semibold tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </Section>

      {/* ── Pricing Teaser ───────────────────────────────────────────────── */}
      <Section className="py-24 lg:py-32">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="text-center"
        >
          <motion.p
            variants={staggerItem}
            className="text-sm font-medium uppercase tracking-widest text-primary"
          >
            Pricing
          </motion.p>
          <motion.h2
            variants={staggerItem}
            className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl"
          >
            Start free. Scale when ready.
          </motion.h2>
          <motion.p
            variants={staggerItem}
            className="mx-auto mt-4 max-w-xl text-muted-foreground"
          >
            No credit card required. Upgrade as your projects grow.
          </motion.p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={staggerContainer}
          className="mx-auto mt-14 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {pricingTiers.map((tier) => (
            <motion.div
              key={tier.name}
              variants={staggerItem}
              className={cn(
                "relative rounded-xl border p-5 transition-colors",
                tier.highlight
                  ? "border-primary/40 bg-primary/[0.03] shadow-md shadow-primary/[0.06]"
                  : "border-border/50 bg-card/70"
              )}
            >
              {tier.highlight && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                  Popular
                </div>
              )}
              <div className="text-sm font-semibold">{tier.name}</div>
              <div className="mt-2 flex items-baseline gap-0.5">
                <span className="text-2xl font-bold tracking-tight">
                  {tier.price}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tier.period}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {tier.description}
              </p>
              <ul className="mt-4 space-y-1.5">
                {tier.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <Check className="size-3 shrink-0 text-success" />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mt-10 text-center"
        >
          <Button variant="outline" asChild>
            <Link href="/pricing">
              View full pricing
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </motion.div>
      </Section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <Section className="py-24 lg:py-32">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={staggerContainer}
          className="relative overflow-hidden rounded-2xl border border-border/50 bg-card px-6 py-16 text-center sm:px-12 sm:py-20"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-brand-muted)_0%,transparent_70%)] opacity-50" />
          <div className="relative">
            <motion.h2
              variants={staggerItem}
              className="mx-auto max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl"
            >
              Ready to turn your next idea into reality?
            </motion.h2>
            <motion.p
              variants={staggerItem}
              className="mx-auto mt-4 max-w-lg text-muted-foreground"
            >
              Join thousands of developers and designers building with
              Calypso. Free to start, no credit card required.
            </motion.p>
            <motion.div
              variants={staggerItem}
              className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
            >
              <Button size="lg" asChild>
                <Link href="/signup">
                  Get Started for Free
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </Section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t border-border/50 bg-card/30">
        <Section className="py-12 sm:py-16">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {/* Brand */}
            <div>
              <Link href="/" className="inline-block">
                <span className="text-lg font-bold tracking-tight">
                  Calypso
                </span>
              </Link>
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                AI-powered design and development platform. From idea to
                production-ready app.
              </p>
              <div className="mt-4 flex gap-3">
                <Button variant="ghost" size="icon-sm" asChild>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Twitter"
                  >
                    <Twitter className="size-4" />
                  </a>
                </Button>
                <Button variant="ghost" size="icon-sm" asChild>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub"
                  >
                    <Github className="size-4" />
                  </a>
                </Button>
              </div>
            </div>

            {/* Product */}
            <div>
              <h4 className="text-sm font-semibold">Product</h4>
              <ul className="mt-3 space-y-2">
                {[
                  { label: "Features", href: "#features" },
                  { label: "Design Studio", href: "/signup" },
                  { label: "Pricing", href: "/pricing" },
                  { label: "Changelog", href: "#" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <h4 className="text-sm font-semibold">Company</h4>
              <ul className="mt-3 space-y-2">
                {[
                  { label: "About", href: "#" },
                  { label: "Blog", href: "#" },
                  { label: "Careers", href: "#" },
                  { label: "Contact", href: "#" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="text-sm font-semibold">Legal</h4>
              <ul className="mt-3 space-y-2">
                {[
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Privacy Policy", href: "/privacy" },
                ].map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-border/50 pt-6">
            <p className="text-center text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Calypso. All rights reserved.
            </p>
          </div>
        </Section>
      </footer>
    </>
  );
}
