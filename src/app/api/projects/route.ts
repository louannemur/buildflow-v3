import { NextResponse } from "next/server";
import { eq, count, desc, and, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { createProjectSchema } from "@/lib/validators/project";
import { getPlanLimits, type Plan } from "@/lib/plan-limits";
import { incrementUsage } from "@/lib/usage";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const sort = searchParams.get("sort") ?? "recent";
    const statusParam = searchParams.get("status") ?? "active";

    const orderBy =
      sort === "name_asc"
        ? [projects.name]
        : sort === "name_desc"
          ? [desc(projects.name)]
          : [desc(projects.updatedAt)];

    const validStatuses = ["active", "completed", "archived"] as const;
    type ProjectStatus = (typeof validStatuses)[number];
    const statusValue = validStatuses.includes(statusParam as ProjectStatus)
      ? (statusParam as ProjectStatus)
      : "active";

    const where =
      statusParam === "all"
        ? eq(projects.userId, userId)
        : and(eq(projects.userId, userId), eq(projects.status, statusValue));

    const items = await db.query.projects.findMany({
      where,
      orderBy,
      columns: {
        id: true,
        name: true,
        description: true,
        thumbnail: true,
        currentStep: true,
        status: true,
        updatedAt: true,
      },
    });

    // Get total count for limit info
    const [{ value: total }] = await db
      .select({ value: count() })
      .from(projects)
      .where(
        and(
          eq(projects.userId, userId),
          ne(projects.status, "archived"),
        ),
      );

    const plan = (session.user.plan ?? "free") as Plan;
    const limits = getPlanLimits(plan);

    return NextResponse.json(
      { items, total, maxProjects: limits.maxProjects },
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
    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const userId = session.user.id;
    const plan = (session.user.plan ?? "free") as Plan;
    const limits = getPlanLimits(plan);

    // Check project limit
    if (limits.maxProjects === 0) {
      return NextResponse.json(
        {
          error: "upgrade_required",
          message:
            "Projects are not available on the Free plan. Upgrade to Studio or higher to create projects.",
        },
        { status: 403 },
      );
    }

    const [{ value: projectCount }] = await db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.userId, userId));

    if (projectCount >= limits.maxProjects) {
      return NextResponse.json(
        {
          error: "limit_reached",
          message: `You've reached your limit of ${limits.maxProjects} project(s). Upgrade your plan for more.`,
        },
        { status: 403 },
      );
    }

    const [project] = await db
      .insert(projects)
      .values({
        userId,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
      })
      .returning({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        currentStep: projects.currentStep,
      });

    await incrementUsage(userId, "projectsCreated");

    return NextResponse.json(project, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
