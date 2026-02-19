import { NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { subscriptions, usage, projects, designs } from "@/lib/db/schema";
import { getPlanLimits, type Plan } from "@/lib/plan-limits";

function getCurrentPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Infinity → 999_999 so it survives JSON serialization */
function safeLimit(value: number): number {
  return value === Infinity ? 999_999 : value;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;

    const [sub, currentUsage, projectCount, designCount] = await Promise.all([
      db.query.subscriptions.findFirst({
        where: eq(subscriptions.userId, userId),
      }),
      db.query.usage.findFirst({
        where: and(
          eq(usage.userId, userId),
          eq(usage.period, getCurrentPeriod()),
        ),
      }),
      // Count actual existing projects
      db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.userId, userId)),
      // Count actual existing designs
      db
        .select({ value: count() })
        .from(designs)
        .where(eq(designs.userId, userId)),
    ]);

    const plan = (sub?.plan ?? "free") as Plan;
    const limits = getPlanLimits(plan);

    // Use daily count for design generations, not the monthly cumulative total
    const today = getCurrentDate();
    const dailyDesignGens =
      currentUsage?.dailyDesignDate === today
        ? (currentUsage.dailyDesignCount ?? 0)
        : 0;

    return NextResponse.json({
      subscription: {
        plan,
        status: sub?.status ?? "active",
        currentPeriodStart: sub?.currentPeriodStart,
        currentPeriodEnd: sub?.currentPeriodEnd,
        cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      },
      usage: {
        designGenerations: dailyDesignGens,
        projectTokensUsed: currentUsage?.projectTokensUsed ?? 0,
        projectsCreated: projectCount[0]?.value ?? 0,
        designsSaved: designCount[0]?.value ?? 0,
      },
      limits: {
        maxProjects: safeLimit(limits.maxProjects),
        maxDesigns: safeLimit(limits.maxDesigns),
        maxDesignGenerationsPerDay: safeLimit(limits.maxDesignGenerationsPerDay),
        maxProjectTokensPerMonth: safeLimit(limits.maxProjectTokensPerMonth),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
