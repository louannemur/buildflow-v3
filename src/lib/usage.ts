import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { usage } from "@/lib/db/schema";
import { getPlanLimits, type Plan } from "@/lib/plan-limits";

export type UsageAction = "ai_generation" | "design_generation";

export type UsageField =
  | "designGenerations"
  | "aiGenerations"
  | "projectsCreated"
  | "designsSaved";

export interface UsageCheckResult {
  allowed: boolean;
  limit: number;
  current: number;
  message: string;
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getCurrentDate(): string {
  return new Date().toISOString().slice(0, 10); // "2026-02-13"
}

export async function checkUsage(
  userId: string,
  plan: Plan,
  action: UsageAction,
): Promise<UsageCheckResult> {
  const limits = getPlanLimits(plan);
  const period = getCurrentPeriod();

  const currentUsage = await db.query.usage.findFirst({
    where: and(eq(usage.userId, userId), eq(usage.period, period)),
  });

  if (action === "ai_generation") {
    const limit = limits.maxAiGenerationsPerMonth;
    const current = currentUsage?.aiGenerations ?? 0;

    if (limit === Infinity) {
      return { allowed: true, limit, current, message: "" };
    }

    if (limit === 0) {
      return {
        allowed: false,
        limit,
        current,
        message:
          "AI project generation is not available on the Free plan. Upgrade to Studio or higher.",
      };
    }

    if (current >= limit) {
      return {
        allowed: false,
        limit,
        current,
        message: `You've reached your monthly limit of ${limit} AI generations. ${
          plan === "studio"
            ? "Upgrade to Pro for 200/month or Founding for unlimited."
            : "Please wait until next month or upgrade your plan."
        }`,
      };
    }

    return { allowed: true, limit, current, message: "" };
  }

  // design_generation — use daily tracking fields
  const limit = limits.maxDesignGenerationsPerDay;

  if (limit === Infinity) {
    return { allowed: true, limit, current: 0, message: "" };
  }

  const today = getCurrentDate();
  const current =
    currentUsage?.dailyDesignDate === today
      ? (currentUsage?.dailyDesignCount ?? 0)
      : 0;

  if (current >= limit) {
    return {
      allowed: false,
      limit,
      current,
      message: `You've reached your daily limit of ${limit} design generations. ${
        plan === "free"
          ? "Upgrade to Studio for 30/day or Pro for unlimited."
          : "Upgrade to Pro for unlimited generations."
      }`,
    };
  }

  return { allowed: true, limit, current, message: "" };
}

export async function incrementUsage(
  userId: string,
  field: UsageField,
): Promise<void> {
  const period = getCurrentPeriod();

  if (field === "designGenerations") {
    const today = getCurrentDate();

    await db
      .insert(usage)
      .values({
        userId,
        period,
        designGenerations: 1,
        dailyDesignDate: today,
        dailyDesignCount: 1,
      })
      .onConflictDoUpdate({
        target: [usage.userId, usage.period],
        set: {
          designGenerations: sql`${usage.designGenerations} + 1`,
          dailyDesignCount: sql`CASE WHEN ${usage.dailyDesignDate} = ${today} THEN ${usage.dailyDesignCount} + 1 ELSE 1 END`,
          dailyDesignDate: today,
        },
      });
  } else {
    await db
      .insert(usage)
      .values({
        userId,
        period,
        [field]: 1,
      })
      .onConflictDoUpdate({
        target: [usage.userId, usage.period],
        set: {
          [field]: sql`${usage[field]} + 1`,
        },
      });
  }
}
