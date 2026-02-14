import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions, usage } from "@/lib/db/schema";
import { getPlanLimits, type Plan } from "@/lib/plan-limits";

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [sub, currentUsage] = await Promise.all([
      db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, session.user.id),
      }),
      db.query.usage.findFirst({
        where: and(
          eq(usage.userId, session.user.id),
          eq(usage.period, getCurrentPeriod()),
        ),
      }),
    ]);

    const plan = (sub?.plan ?? "free") as Plan;
    const limits = getPlanLimits(plan);

    return NextResponse.json({
      subscription: {
        plan,
        status: sub?.status ?? "active",
        currentPeriodStart: sub?.currentPeriodStart,
        currentPeriodEnd: sub?.currentPeriodEnd,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      },
      usage: {
        designGenerations: currentUsage?.designGenerations ?? 0,
        aiGenerations: currentUsage?.aiGenerations ?? 0,
        projectsCreated: currentUsage?.projectsCreated ?? 0,
        designsSaved: currentUsage?.designsSaved ?? 0,
      },
      limits: {
        maxProjects: limits.maxProjects,
        maxDesigns: limits.maxDesigns,
        maxDesignGenerationsPerDay: limits.maxDesignGenerationsPerDay,
        maxAiGenerationsPerMonth: limits.maxAiGenerationsPerMonth,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
