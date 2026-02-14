import { NextResponse } from "next/server";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { db } from "@/lib/db";
import { features, userFlows, projects } from "@/lib/db/schema";
import { checkUsage, incrementUsage } from "@/lib/usage";
import type { Plan } from "@/lib/plan-limits";

const SYSTEM_PROMPT = `You are a UX designer. Given the project info and features, generate the key user flows.

Each flow should have a title and an ordered list of steps. Each step has:
- id: a unique short string (e.g. "s1", "s2")
- title: 3-6 words describing the step
- description: 1 sentence explaining what happens
- type: one of "action" | "decision" | "navigation" | "input" | "display"

Step types:
- action: User performs an action (click, tap, submit)
- decision: A branching point or conditional
- navigation: Moving to a different page/screen
- input: User enters data (form, search)
- display: System shows information to user

Generate 3-6 flows covering the main user journeys.

Respond with ONLY a JSON array, no other text:
[{"title": "...", "steps": [{"id": "s1", "title": "...", "description": "...", "type": "action"}, ...]}]`;

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

    let userMessage = `Project: ${project.name}`;
    if (project.description) {
      userMessage += `\nDescription: ${project.description}`;
    }
    if (projectFeatures.length > 0) {
      userMessage += `\n\nFeatures:\n${projectFeatures.map((f) => `- ${f.title}: ${f.description}`).join("\n")}`;
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to generate flows. Please try again." },
        { status: 500 },
      );
    }

    const generated = JSON.parse(jsonMatch[0]) as {
      title: string;
      steps: { id: string; title: string; description: string; type: string }[];
    }[];

    if (!Array.isArray(generated) || generated.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate flows. Please try again." },
        { status: 500 },
      );
    }

    // Delete existing flows
    await db.delete(userFlows).where(eq(userFlows.projectId, id));

    // Insert generated flows
    const newFlows = await db
      .insert(userFlows)
      .values(
        generated.map((f, i) => ({
          projectId: id,
          title: f.title,
          steps: f.steps,
          order: i,
        })),
      )
      .returning();

    // Increment AI usage
    await incrementUsage(userId, "aiGenerations");

    return NextResponse.json({ items: newFlows }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
