import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { db } from "@/lib/db";
import { features, projects } from "@/lib/db/schema";
import { checkUsage, incrementUsage } from "@/lib/usage";
import type { Plan } from "@/lib/plan-limits";

const SYSTEM_PROMPT = `You are a product strategist. Given the project name and description, generate 6-10 key features for an MVP.

Each feature should have:
- A clear, concise title (3-6 words)
- A 1-2 sentence description explaining what it does and why it matters

Focus on core MVP features that are essential for launch, not nice-to-haves.

Respond with ONLY a JSON array, no other text:
[{"title": "...", "description": "..."}, ...]`;

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

    const userMessage = project.description
      ? `Project: ${project.name}\nDescription: ${project.description}`
      : `Project: ${project.name}`;

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the JSON array from Claude
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to generate features. Please try again." },
        { status: 500 },
      );
    }

    const generated = JSON.parse(jsonMatch[0]) as {
      title: string;
      description: string;
    }[];

    if (!Array.isArray(generated) || generated.length === 0) {
      return NextResponse.json(
        { error: "Failed to generate features. Please try again." },
        { status: 500 },
      );
    }

    // Delete existing features for this project
    await db.delete(features).where(eq(features.projectId, id));

    // Insert generated features
    const newFeatures = await db
      .insert(features)
      .values(
        generated.map((f, i) => ({
          projectId: id,
          title: f.title,
          description: f.description,
          order: i,
        })),
      )
      .returning();

    // Increment AI usage
    await incrementUsage(userId, "aiGenerations");

    return NextResponse.json({ items: newFeatures }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
