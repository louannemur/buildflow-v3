import { NextResponse } from "next/server";
import { eq, and, count, desc, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { designs } from "@/lib/db/schema";
import { createDesignSchema } from "@/lib/validators/design";
import { getPlanLimits } from "@/lib/plan-limits";
import { getUserPlan, incrementUsage } from "@/lib/usage";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") ?? "all";

    const baseCondition = eq(designs.userId, userId);

    const where =
      filter === "standalone"
        ? and(baseCondition, eq(designs.isStandalone, true))
        : filter === "project"
          ? and(baseCondition, isNotNull(designs.projectId))
          : baseCondition;

    const items = await db.query.designs.findMany({
      where,
      orderBy: [desc(designs.updatedAt)],
      columns: {
        id: true,
        name: true,
        thumbnail: true,
        isStandalone: true,
        projectId: true,
        updatedAt: true,
      },
      with: {
        project: {
          columns: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Count standalone designs for limit display
    const [{ value: standaloneCount }] = await db
      .select({ value: count() })
      .from(designs)
      .where(and(eq(designs.userId, userId), eq(designs.isStandalone, true)));

    const plan = await getUserPlan(userId);
    const limits = getPlanLimits(plan);

    return NextResponse.json(
      {
        items,
        standaloneCount,
        // Infinity → null in JSON, which breaks client-side comparisons
        maxDesigns: limits.maxDesigns === Infinity ? -1 : limits.maxDesigns,
      },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createDesignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const userId = session.user.id;
    const plan = await getUserPlan(userId);
    const limits = getPlanLimits(plan);

    // Check design limit (only applies to free plan)
    if (limits.maxDesigns !== Infinity) {
      const [{ value: designCount }] = await db
        .select({ value: count() })
        .from(designs)
        .where(
          and(eq(designs.userId, userId), eq(designs.isStandalone, true)),
        );

      if (designCount >= limits.maxDesigns) {
        return NextResponse.json(
          {
            error: "limit_reached",
            message: `You've reached your limit of ${limits.maxDesigns} saved designs. Upgrade your plan for unlimited designs.`,
          },
          { status: 403 },
        );
      }
    }

    const [design] = await db
      .insert(designs)
      .values({
        userId,
        name: parsed.data.name,
        html: "",
        isStandalone: true,
      })
      .returning({
        id: designs.id,
        name: designs.name,
      });

    await incrementUsage(userId, "designsSaved");

    return NextResponse.json(design, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
