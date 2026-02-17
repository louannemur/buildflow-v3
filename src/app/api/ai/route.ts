import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { designs, projects, pages } from "@/lib/db/schema";
import { getUserPlan, checkUsage, incrementUsage } from "@/lib/usage";
import {
  generateDesign,
  editDesign,
  modifyElement,
  addSection,
  inferPageType,
  reviewAndFixDesign,
} from "@/lib/ai/design";

/* ─── Helpers ──────────────────────────────────────────────────────── */

interface DesignContext {
  projectName: string;
  projectDescription: string;
  pageName: string;
  pageType: string;
  styleGuideCode: string | undefined;
}

async function getDesignContext(
  designId: string | undefined,
): Promise<DesignContext> {
  const fallback: DesignContext = {
    projectName: "Untitled",
    projectDescription: "",
    pageName: "Page",
    pageType: "LANDING",
    styleGuideCode: undefined,
  };

  if (!designId) return fallback;

  const design = await db.query.designs.findFirst({
    where: eq(designs.id, designId),
    columns: { projectId: true, pageId: true, name: true, isStyleGuide: true },
  });

  if (!design) return fallback;

  fallback.pageName = design.name;

  if (design.projectId) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, design.projectId),
      columns: { name: true, description: true },
    });
    if (project) {
      fallback.projectName = project.name;
      fallback.projectDescription = project.description ?? "";
    }

    // Look for a style guide design in the same project
    if (!design.isStyleGuide) {
      const styleGuide = await db.query.designs.findFirst({
        where: and(
          eq(designs.projectId, design.projectId),
          eq(designs.isStyleGuide, true),
        ),
        columns: { html: true },
      });
      if (styleGuide?.html) {
        fallback.styleGuideCode = styleGuide.html;
      }
    }
  }

  if (design.pageId) {
    const page = await db.query.pages.findFirst({
      where: eq(pages.id, design.pageId),
      columns: { title: true },
    });
    if (page) {
      fallback.pageName = page.title;
    }
  }

  // Infer the page type from the page name
  fallback.pageType = inferPageType(fallback.pageName);

  return fallback;
}

/* ─── Route ────────────────────────────────────────────────────────── */

export async function POST(req: Request) {
  // 1. Auth check
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const plan = await getUserPlan(userId);

  const body = await req.json();
  if (!body || typeof body.action !== "string") {
    return NextResponse.json(
      { error: "Invalid request: action required" },
      { status: 400 },
    );
  }

  const { action, designId, ...data } = body;

  // 2. Usage check
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

  // 3. Look up design/project context
  const ctx = await getDesignContext(designId);

  try {
    let result: string;

    switch (action) {
      case "generate-design": {
        const pageType = inferPageType(ctx.pageName);
        const generated = await generateDesign({
          projectName: ctx.projectName,
          projectDescription: ctx.projectDescription,
          pageName: ctx.pageName,
          pageType,
          sections: (data.sections as string[]) ?? ["Hero section", "Features", "Call to action"],
          styleGuideCode: ctx.styleGuideCode,
          creativePrompt: data.prompt as string | undefined,
        });
        result = await reviewAndFixDesign(generated);
        break;
      }

      case "edit-design":
        result = await editDesign({
          projectName: ctx.projectName,
          projectDescription: ctx.projectDescription,
          pageName: ctx.pageName,
          pageType: ctx.pageType,
          previousHtml: data.currentCode ?? "",
          editRequest: data.prompt ?? "",
          styleGuideCode: ctx.styleGuideCode,
          conversationHistory: data.conversationHistory,
        });
        break;

      case "modify-element":
        result = await modifyElement({
          elementHtml: data.elementContext ?? "",
          elementId: data.bfId ?? "",
          elementTag: "",
          elementClasses: "",
          fullPageHtml: data.currentCode ?? "",
          userRequest: data.prompt ?? "",
        });
        break;

      case "add-section":
        result = await addSection({
          projectName: ctx.projectName,
          pageName: ctx.pageName,
          afterElementHtml: "",
          afterElementTag: "",
          fullPageHtml: data.currentCode ?? "",
          userRequest: data.prompt ?? "",
        });
        break;

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 },
        );
    }

    // 4. Increment usage
    await incrementUsage(userId, "designGenerations");

    return NextResponse.json({ code: result });
  } catch (error) {
    console.error("AI design error:", error);
    return NextResponse.json(
      { error: "AI generation failed. Please try again." },
      { status: 500 },
    );
  }
}
