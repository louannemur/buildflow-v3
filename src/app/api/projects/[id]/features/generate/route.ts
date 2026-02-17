import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { db } from "@/lib/db";
import { features, projects } from "@/lib/db/schema";
import { getUserPlan, checkUsage, incrementUsage } from "@/lib/usage";
import { createSSEResponse } from "@/lib/sse";

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
    const plan = await getUserPlan(userId);
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

    return createSSEResponse(async (enqueue) => {
      const stream = anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });

      let accumulated = "";

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          accumulated += event.delta.text;
          enqueue({ type: "progress", text: event.delta.text });
        }
      }

      // Parse the JSON array from accumulated text
      const jsonMatch = accumulated.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        enqueue({
          type: "error",
          message: "Failed to generate features. Please try again.",
        });
        return;
      }

      const generated = JSON.parse(jsonMatch[0]) as {
        title: string;
        description: string;
      }[];

      if (!Array.isArray(generated) || generated.length === 0) {
        enqueue({
          type: "error",
          message: "Failed to generate features. Please try again.",
        });
        return;
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

      // Emit each feature individually for animated reveal
      for (const feature of newFeatures) {
        enqueue({ type: "item", feature });
      }

      enqueue({ type: "done", items: newFeatures });
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
