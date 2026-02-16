import { NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  designs,
  designVersions,
  projects,
  pages,
  features,
  userFlows,
} from "@/lib/db/schema";
import { getUserPlan, checkUsage, incrementUsage } from "@/lib/usage";
import { generateDesign, inferPageType, reviewAndFixDesign } from "@/lib/ai/design";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const userId = session.user.id;

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
      columns: { id: true, name: true, description: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    // Parse body
    const body = await req.json();
    const pageId = body.pageId;
    const skipReview = body.skipReview === true;

    if (!pageId || typeof pageId !== "string") {
      return NextResponse.json(
        { error: "pageId is required" },
        { status: 400 },
      );
    }

    // Find the page
    const page = await db.query.pages.findFirst({
      where: and(eq(pages.id, pageId), eq(pages.projectId, projectId)),
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Usage check
    const plan = await getUserPlan(userId);
    const usageCheck = await checkUsage(userId, plan, "design_generation");
    if (!usageCheck.allowed) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message: usageCheck.message,
          code: "LIMIT_REACHED",
        },
        { status: 429 },
      );
    }

    // Check if a design already exists for this page
    let design = await db.query.designs.findFirst({
      where: and(
        eq(designs.pageId, pageId),
        eq(designs.projectId, projectId),
        eq(designs.userId, userId),
      ),
    });

    // Create design record if it doesn't exist
    if (!design) {
      const [created] = await db
        .insert(designs)
        .values({
          userId,
          projectId,
          pageId,
          name: page.title,
          html: "",
          isStandalone: false,
        })
        .returning();
      design = created;
    }

    // Skip if already has HTML content
    if (design.html && design.html.length > 0) {
      return NextResponse.json({
        id: design.id,
        name: design.name,
        html: design.html,
        thumbnail: design.thumbnail,
        fonts: design.fonts,
        colors: design.colors,
        isStandalone: design.isStandalone,
        isStyleGuide: design.isStyleGuide,
        pageId: design.pageId,
        createdAt: design.createdAt.toISOString(),
        updatedAt: design.updatedAt.toISOString(),
      });
    }

    // Fetch style guide if one exists
    let styleGuideCode: string | undefined;
    const styleGuide = await db.query.designs.findFirst({
      where: and(
        eq(designs.projectId, projectId),
        eq(designs.isStyleGuide, true),
        eq(designs.userId, userId),
      ),
      columns: { html: true },
    });
    if (styleGuide?.html) {
      styleGuideCode = styleGuide.html;
    }

    // Build sections from page contents + project features
    const sections: string[] = [];

    if (page.contents && page.contents.length > 0) {
      for (const content of page.contents) {
        sections.push(`${content.name}: ${content.description}`);
      }
    }

    // If no sections defined, fetch features to use as context
    if (sections.length === 0) {
      const projectFeatures = await db.query.features.findMany({
        where: eq(features.projectId, projectId),
        columns: { title: true },
        orderBy: [asc(features.order)],
      });
      for (const f of projectFeatures) {
        sections.push(f.title);
      }
    }

    // Fallback sections if still empty
    if (sections.length === 0) {
      sections.push("Hero section", "Features", "Call to action");
    }

    const pageType = inferPageType(page.title);

    // Generate the design
    let html = await generateDesign({
      projectName: project.name,
      projectDescription: project.description ?? "",
      pageName: page.title,
      pageType,
      sections,
      styleGuideCode,
    });

    // Review & fix readability issues (navbar contrast, text visibility, etc.)
    if (!skipReview) {
      html = await reviewAndFixDesign(html);
    }

    // Save the generated HTML
    const [updated] = await db
      .update(designs)
      .set({ html })
      .where(eq(designs.id, design.id))
      .returning();

    // Create a version snapshot
    await db.insert(designVersions).values({
      designId: design.id,
      html,
      prompt: "Auto-generated",
    });

    // Increment usage
    await incrementUsage(userId, "designGenerations");

    return NextResponse.json(
      {
        id: updated.id,
        name: updated.name,
        html: updated.html,
        thumbnail: updated.thumbnail,
        fonts: updated.fonts,
        colors: updated.colors,
        isStandalone: updated.isStandalone,
        isStyleGuide: updated.isStyleGuide,
        pageId: updated.pageId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Design generation error:", error);
    return NextResponse.json(
      { error: "Design generation failed. Please try again." },
      { status: 500 },
    );
  }
}
