import { NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { designs, projects, pages } from "@/lib/db/schema";
import { getPlanLimits } from "@/lib/plan-limits";
import { getUserPlan } from "@/lib/usage";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;
    const plan = await getUserPlan(userId);
    const limits = getPlanLimits(plan);

    // Optional overrides from body
    let bodyName: string | undefined;
    let bodyDescription: string | undefined;
    try {
      const body = await req.json();
      if (body.name && typeof body.name === "string") bodyName = body.name.trim().slice(0, 100);
      if (body.description && typeof body.description === "string") bodyDescription = body.description.trim().slice(0, 500);
    } catch {
      // No body is fine — we'll fall back to the design name
    }

    // Check project limits
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

    // Get the design and verify ownership + standalone
    const design = await db.query.designs.findFirst({
      where: and(
        eq(designs.id, id),
        eq(designs.userId, userId),
        eq(designs.isStandalone, true),
      ),
    });

    if (!design) {
      return NextResponse.json(
        { error: "Design not found or is already part of a project" },
        { status: 404 },
      );
    }

    // Create project
    const [project] = await db
      .insert(projects)
      .values({
        userId,
        name: bodyName || design.name,
        description: bodyDescription || null,
        currentStep: "designs",
      })
      .returning({ id: projects.id, name: projects.name });

    // Create a page for the design
    const [page] = await db
      .insert(pages)
      .values({
        projectId: project.id,
        title: "Home",
        order: 0,
      })
      .returning({ id: pages.id });

    // Link the design to the project and page
    await db
      .update(designs)
      .set({
        projectId: project.id,
        pageId: page.id,
        isStandalone: false,
      })
      .where(eq(designs.id, id));

    return NextResponse.json(
      { projectId: project.id, projectName: project.name },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
