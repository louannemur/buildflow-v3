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
} from "@/lib/db/schema";
import { getUserPlan, checkUsage, incrementUsage } from "@/lib/usage";
import { generateDesign, generateDesignStream, inferPageType, reviewAndFixDesign } from "@/lib/ai/design";
import { extractHtmlFromResponse } from "@/lib/ai/extract-code";
import { createSSEResponse } from "@/lib/sse";

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
    const forceRegenerate = body.forceRegenerate === true;
    const useStyleGuide = body.useStyleGuide !== false; // default true
    const stylePrompt: string | undefined = body.stylePrompt;
    const wantStream = body.stream === true;

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

    // Skip if already has HTML content (unless force regenerating)
    if (design.html && design.html.length > 0 && !forceRegenerate) {
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

    // Save pre-regeneration snapshot for revert
    let previousHtml: string | null = null;
    if (forceRegenerate && design.html && design.html.length > 0) {
      previousHtml = design.html;
      await db.insert(designVersions).values({
        designId: design.id,
        html: design.html,
        prompt: "Pre-regeneration snapshot",
      });
    }

    // Fetch style guide if one exists (and we want to use it)
    let styleGuideCode: string | undefined;
    if (useStyleGuide) {
      const styleGuide = await db.query.designs.findFirst({
        where: and(
          eq(designs.projectId, projectId),
          eq(designs.isStyleGuide, true),
          eq(designs.userId, userId),
        ),
        columns: { id: true, html: true },
      });
      if (styleGuide?.html && styleGuide.id !== design.id) {
        styleGuideCode = styleGuide.html;
      }
    }

    // Fetch all pages for navigation context
    const allPages = await db.query.pages.findMany({
      where: eq(pages.projectId, projectId),
      columns: { id: true, title: true, description: true },
      orderBy: [asc(pages.order)],
    });

    // Fetch existing designs for other pages (style consistency)
    const existingDesigns = await db.query.designs.findMany({
      where: and(
        eq(designs.projectId, projectId),
        eq(designs.userId, userId),
      ),
      columns: { pageId: true, html: true, name: true },
    });

    const allPageNames = allPages.map((p) => p.title);
    const otherDesignHtmls = existingDesigns
      .filter((d) => d.pageId !== pageId && d.html && d.html.length > 0)
      .map((d) => ({ pageName: d.name, html: d.html }));

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

    const generationParams = {
      projectName: project.name,
      projectDescription: project.description ?? "",
      pageName: page.title,
      pageType,
      sections,
      styleGuideCode,
      allPageNames,
      otherDesignHtmls,
      creativePrompt: !useStyleGuide ? stylePrompt : undefined,
    };

    // ─── Streaming path ──────────────────────────────────────────────
    if (wantStream) {
      return createSSEResponse(async (enqueue) => {
        let accumulated = "";

        for await (const chunk of generateDesignStream(generationParams)) {
          accumulated += chunk.text;
          enqueue({ type: "chunk", text: chunk.text });
        }

        const html = extractHtmlFromResponse(accumulated);

        // Save the generated HTML
        const [updated] = await db
          .update(designs)
          .set({ html })
          .where(eq(designs.id, design.id))
          .returning();

        // Auto-set as style guide if no style guide exists yet
        let isNowStyleGuide = updated.isStyleGuide;
        if (!styleGuideCode && useStyleGuide) {
          const existingStyleGuide = await db.query.designs.findFirst({
            where: and(
              eq(designs.projectId, projectId),
              eq(designs.isStyleGuide, true),
              eq(designs.userId, userId),
            ),
            columns: { id: true },
          });

          if (!existingStyleGuide) {
            await db
              .update(designs)
              .set({ isStyleGuide: true })
              .where(eq(designs.id, design.id));
            isNowStyleGuide = true;
          }
        }

        // Create a version snapshot
        await db.insert(designVersions).values({
          designId: design.id,
          html,
          prompt: forceRegenerate
            ? `Regenerated${stylePrompt ? ` — ${stylePrompt}` : ""}`
            : "Auto-generated",
        });

        await incrementUsage(userId, "designGenerations");

        enqueue({
          type: "done",
          design: {
            id: updated.id,
            name: updated.name,
            html: updated.html,
            thumbnail: updated.thumbnail,
            fonts: updated.fonts,
            colors: updated.colors,
            isStandalone: updated.isStandalone,
            isStyleGuide: isNowStyleGuide,
            pageId: updated.pageId,
            createdAt: updated.createdAt.toISOString(),
            updatedAt: updated.updatedAt.toISOString(),
            ...(previousHtml && { previousHtml }),
          },
        });
      });
    }

    // ─── Non-streaming path (unchanged) ──────────────────────────────
    let html = await generateDesign(generationParams);

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

    // Auto-set as style guide if no style guide exists yet
    let isNowStyleGuide = updated.isStyleGuide;
    if (!styleGuideCode && useStyleGuide) {
      const existingStyleGuide = await db.query.designs.findFirst({
        where: and(
          eq(designs.projectId, projectId),
          eq(designs.isStyleGuide, true),
          eq(designs.userId, userId),
        ),
        columns: { id: true },
      });

      if (!existingStyleGuide) {
        await db
          .update(designs)
          .set({ isStyleGuide: true })
          .where(eq(designs.id, design.id));
        isNowStyleGuide = true;
      }
    }

    // Create a version snapshot
    await db.insert(designVersions).values({
      designId: design.id,
      html,
      prompt: forceRegenerate
        ? `Regenerated${stylePrompt ? ` — ${stylePrompt}` : ""}`
        : "Auto-generated",
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
        isStyleGuide: isNowStyleGuide,
        pageId: updated.pageId,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        ...(previousHtml && { previousHtml }),
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
