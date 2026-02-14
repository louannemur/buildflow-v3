import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { designs, projects, pages } from "@/lib/db/schema";
import { getUserPlan, checkUsage, incrementUsage } from "@/lib/usage";
import {
  editDesignStream,
  modifyElementStream,
  addSectionStream,
  inferPageType,
} from "@/lib/ai/design";

/* ─── Context Lookup ───────────────────────────────────────────── */

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
  const ctx: DesignContext = {
    projectName: "Untitled",
    projectDescription: "",
    pageName: "Page",
    pageType: "LANDING",
    styleGuideCode: undefined,
  };

  if (!designId) return ctx;

  const design = await db.query.designs.findFirst({
    where: eq(designs.id, designId),
    columns: { projectId: true, pageId: true, name: true, isStyleGuide: true },
  });
  if (!design) return ctx;

  ctx.pageName = design.name;

  if (design.projectId) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, design.projectId),
      columns: { name: true, description: true },
    });
    if (project) {
      ctx.projectName = project.name;
      ctx.projectDescription = project.description ?? "";
    }

    if (!design.isStyleGuide) {
      const styleGuide = await db.query.designs.findFirst({
        where: and(
          eq(designs.projectId, design.projectId),
          eq(designs.isStyleGuide, true),
        ),
        columns: { html: true },
      });
      if (styleGuide?.html) {
        ctx.styleGuideCode = styleGuide.html;
      }
    }
  }

  if (design.pageId) {
    const page = await db.query.pages.findFirst({
      where: eq(pages.id, design.pageId),
      columns: { title: true },
    });
    if (page) ctx.pageName = page.title;
  }

  // Infer the page type from the page name
  ctx.pageType = inferPageType(ctx.pageName);

  return ctx;
}

/* ─── Route ────────────────────────────────────────────────────── */

export async function POST(req: Request) {
  // 1. Auth
  const session = await auth();
  if (!session?.user) {
    return new Response(
      `data: ${JSON.stringify({ error: "Unauthorized" })}\n\n`,
      { status: 401, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const userId = session.user.id;
  const plan = await getUserPlan(userId);

  const body = await req.json();
  const { action, designId, ...data } = body;

  if (!action) {
    return new Response(
      `data: ${JSON.stringify({ error: "Action required" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  // 2. Usage check
  const usageCheck = await checkUsage(userId, plan, "design_generation");
  if (!usageCheck.allowed) {
    return new Response(
      `data: ${JSON.stringify({ error: "rate_limited", code: "LIMIT_REACHED", message: usageCheck.message })}\n\n`,
      { status: 429, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  // 3. Context
  const ctx = await getDesignContext(designId);

  // 4. Get the stream for the requested action
  let stream: AsyncGenerator<{ text: string }>;

  switch (action) {
    case "edit-design":
      stream = editDesignStream({
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
      stream = modifyElementStream({
        elementHtml: data.elementContext ?? "",
        elementId: data.bfId ?? "",
        elementTag: "",
        elementClasses: "",
        fullPageHtml: data.currentCode ?? "",
        userRequest: data.prompt ?? "",
      });
      break;

    case "add-section":
      stream = addSectionStream({
        projectName: ctx.projectName,
        pageName: ctx.pageName,
        afterElementHtml: "",
        afterElementTag: "",
        fullPageHtml: data.currentCode ?? "",
        userRequest: data.prompt ?? "",
      });
      break;

    default:
      return new Response(
        `data: ${JSON.stringify({ error: "Unknown action" })}\n\n`,
        { status: 400, headers: { "Content-Type": "text/event-stream" } },
      );
  }

  // 5. Stream the response as SSE
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ text: chunk.text })}\n\n`,
            ),
          );
        }

        // Signal completion
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`),
        );
        controller.close();

        // Increment usage after successful generation
        await incrementUsage(userId, "designGenerations");
      } catch (error) {
        console.error("Stream error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Generation failed" })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
