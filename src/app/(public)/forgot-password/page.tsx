"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.06,
      duration: 0.4,
      ease: [0.25, 0.4, 0, 1] as [number, number, number, number],
    },
  }),
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }

    setIsLoading(true);

    // TODO: Implement actual password reset email sending
    // For now, simulate a short delay and show success
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setSent(true);
    setIsLoading(false);
  }

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] items-center justify-center px-4 py-12">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-brand-muted)_0%,transparent_50%)] opacity-50" />

      <motion.div
        initial="hidden"
        animate="visible"
        className="relative z-10 w-full max-w-[400px]"
      >
        {/* Logo */}
        <motion.div custom={0} variants={fadeUp} className="mb-8 text-center">
          <Link href="/" className="inline-block">
            <h1 className="text-2xl font-bold tracking-tight">
              Build<span className="text-primary">Flow</span>
            </h1>
          </Link>
        </motion.div>

        <motion.div custom={1} variants={fadeUp}>
          <Card className="border-border/50 shadow-lg shadow-black/[0.03] dark:shadow-black/[0.2]">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">
                {sent ? "Check your email" : "Reset your password"}
              </CardTitle>
              <CardDescription>
                {sent
                  ? "We sent a password reset link to your email"
                  : "Enter your email and we'll send you a reset link"}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              {sent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  <div className="flex justify-center">
                    <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
                      <Mail className="size-6 text-success" />
                    </div>
                  </div>
                  <p className="text-center text-sm text-muted-foreground">
                    If an account exists for{" "}
                    <span className="font-medium text-foreground">{email}</span>,
                    you&apos;ll receive a password reset link shortly.
                  </p>
                  <Button
                    variant="outline"
                    className="h-10 w-full"
                    onClick={() => {
                      setSent(false);
                      setEmail("");
                    }}
                  >
                    Try another email
                  </Button>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5 text-sm text-destructive"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={!!error}
                      disabled={isLoading}
                      autoComplete="email"
                      autoFocus
                    />
                  </div>

                  <Button
                    type="submit"
                    className="h-10 w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      "Send reset link"
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer link */}
        <motion.p
          custom={2}
          variants={fadeUp}
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          <Link
            href="/login"
            className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to login
          </Link>
        </motion.p>
      </motion.div>
    </div>
  );
}
