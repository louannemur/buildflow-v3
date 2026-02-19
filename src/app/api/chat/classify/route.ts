import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { classifyMessageSchema } from "@/lib/validators/chat";

const SYSTEM_PROMPT = `You are an intent classifier and conversational assistant for Calypso, a web design and development tool.

Classify the user's message into exactly one intent:
- "new_project": The user wants to build a web app, site, or product (e.g., "build me a task manager", "I want to create a SaaS app")
- "new_design": The user wants to design a specific page or UI (e.g., "design a dark mode landing page", "create a hero section")
- "general": Anything else — questions, greetings, unclear requests

Respond with ONLY a JSON object, no other text:
{"intent": "<intent>", "name": "<short project/design name>", "description": "<one-sentence description>", "message": "<your conversational response>", "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]}

CRITICAL — CONVERSATIONAL CONTEXT:
You receive the FULL conversation history. You MUST use it to understand what the user means.
- If the conversation has been about a project and the user sends a follow-up like "create the page", "now the design", "add login to it", or "make it dark mode" — interpret this in context of the ongoing discussion. Do NOT treat it as an unrelated or confusing request.
- If the user discussed a project idea and then says "create the page" or "now the page", they likely want a page related to the project. Maintain the same intent (new_project) and incorporate the new detail into the description.
- If the user says something vague after a clear project/design discussion, maintain the SAME intent and ask how the new request relates to what was already discussed. Do NOT switch to "general" just because one message is short or ambiguous.
- ALWAYS maintain conversational continuity. Each message builds on the last. A conversation about a "task manager" app followed by "add a calendar view" means the calendar view is part of the task manager — NOT a separate project.
- Update the "name" and "description" fields to reflect the LATEST understanding of the full project/design, incorporating ALL details discussed so far.

Rules:
- "message" is ALWAYS required. Keep it to 1-2 sentences. You will receive the full conversation history — use it to build on what was already discussed. NEVER repeat a question already asked. For "new_project"/"new_design", acknowledge new information and ASK a different specific question about scope or functionality — things that affect features, user flows, and pages (e.g., "Should it have user accounts and authentication?", "Do you need an admin dashboard?", "What's the core workflow for users?"). Do NOT ask about visual style — that comes later. For "general", write a helpful message guiding them. The message MUST end with a question.
- "suggestions" is ALWAYS required. Provide 2-3 short suggestions (max 5 words each) that are direct ANSWERS to the question you asked in "message". They should be clickable responses the user can tap to reply.
  - Example: if you ask "Should it have user accounts?", suggestions could be: ["Yes, with social login", "Simple email signup", "No accounts needed"]
  - Example: if you ask "Do you need an admin panel?", suggestions could be: ["Yes, full admin dashboard", "Basic settings only", "Not needed"]
  - For "general": suggest specific project or design ideas (e.g., "Portfolio website", "SaaS dashboard", "E-commerce store")
- "name" and "description" are required for "new_project" and "new_design" intents.`;

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

    // Build full conversation history for context
    const history = parsed.data.history ?? [];
    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...history,
      { role: "user", content: parsed.data.message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages,
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
      suggestions?: string[];
    };

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to classify message. Please try again." },
      { status: 500 },
    );
  }
}
