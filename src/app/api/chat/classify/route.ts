import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { classifyMessageSchema } from "@/lib/validators/chat";

const SYSTEM_PROMPT = `You are an intent classifier for BuildFlow, a web design and development tool.

Classify the user's message into exactly one intent:
- "new_project": The user wants to build a web app, site, or product (e.g., "build me a task manager", "I want to create a SaaS app")
- "new_design": The user wants to design a specific page or UI (e.g., "design a dark mode landing page", "create a hero section")
- "general": Anything else — questions, greetings, unclear requests

Respond with ONLY a JSON object, no other text:
{"intent": "<intent>", "name": "<short project/design name if applicable>", "description": "<one-sentence description if applicable>", "message": "<helpful response if intent is general>"}

For "general" intent, include a friendly message helping them use BuildFlow. For "new_project" and "new_design", extract a clear name and description from their request.`;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = classifyMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: parsed.data.message }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the JSON response from Claude
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        {
          intent: "general" as const,
          message:
            "I can help you create projects and designs. Try describing what you want to build!",
        },
        { status: 200 },
      );
    }

    const result = JSON.parse(jsonMatch[0]) as {
      intent: "new_project" | "new_design" | "general";
      name?: string;
      description?: string;
      message?: string;
    };

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to classify message. Please try again." },
      { status: 500 },
    );
  }
}
