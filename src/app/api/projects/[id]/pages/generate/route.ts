import { NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { db } from "@/lib/db";
import { features, userFlows, pages, projects } from "@/lib/db/schema";
import { checkUsage, incrementUsage } from "@/lib/usage";
import type { Plan } from "@/lib/plan-limits";

const SYSTEM_PROMPT = `You are a product designer. Given the project info, features, and user flows, determine all the pages this application needs.

For each page, provide a title, brief description, and a list of content sections/components the page should contain. Each content item has a name and description.

Be thorough — include auth pages, error pages, settings, dashboard, etc.

Generate 6-15 pages covering the complete application.

Respond with ONLY a JSON array, no other text:
[{"title": "...", "description": "...", "contents": [{"id": "c1", "name": "...", "description": "..."}, ...]}]`;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, userId)),
      columns: { id: true, name: true, description: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    // Check AI usage limits
    const plan = (session.user.plan ?? "free") as Plan;
    const usageCheck = await checkUsage(userId, plan, "ai_generation");
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: "limit_reached", message: usageCheck.message },
        { status: 403 },
      );
    }

    // Get project features for context
    const projectFeatures = await db.query.features.findMany({
      where: eq(features.projectId, id),
      orderBy: [asc(features.order)],
      columns: { title: true, description: true },
    });

    // Get user flows for context
    const projectFlows = await db.query.userFlows.findMany({
      where: eq(userFlows.projectId, id),
      orderBy: [asc(userFlows.order)],
      columns: { title: true, steps: true },
    });

    let userMessage = `Project: ${project.name}`;
    if (project.description) {
      userMessage += `\nDescription: ${project.description}`;
    }
    if (projectFeatures.length > 0) {
      userMessage += `\n\nFeatures:\n${projectFeatures.map((f) => `- ${f.title}: ${f.description}`).join("\n")}`;
    }
    if (projectFlows.length > 0) {
      userMessage += `\n\nUser Flows:\n${projectFlows.map((f) => `- ${f.title} (${f.steps?.length ?? 0} steps)`).join("\n")}`;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to generate pages. Please try again." },
        { status: 500 },
      );
    }

    const generated = JSON.parse(jsonMatch[0]) as {
      title: string;
      description: string;
      contents: { id: string; name: string; description: string }[];
    }[];

    if (!Array.isArray(generated) || generated.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate pages. Please try again." },
        { status: 500 },
      );
    }

    // Delete existing pages
    await db.delete(pages).where(eq(pages.projectId, id));

    // Insert generated pages
    const newPages = await db
      .insert(pages)
      .values(
        generated.map((p, i) => ({
          projectId: id,
          title: p.title,
          description: p.description,
          contents: p.contents,
          order: i,
        })),
      )
      .returning();

    // Increment AI usage
    await incrementUsage(userId, "aiGenerations");

    return NextResponse.json({ items: newPages }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
