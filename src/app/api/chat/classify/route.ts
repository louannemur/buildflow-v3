import { NextResponse } from "next/server";
import { eq, desc, ne, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { db } from "@/lib/db";
import { projects, pages } from "@/lib/db/schema";
import { classifyMessageSchema } from "@/lib/validators/chat";

function buildSystemPrompt(
  userProjects: { id: string; name: string; description: string | null }[],
) {
  const projectList =
    userProjects.length > 0
      ? userProjects
          .map(
            (p) =>
              `- [${p.id}] "${p.name}"${p.description ? `: ${p.description}` : ""}`,
          )
          .join("\n")
      : "(none)";

  return `You are an intent classifier and conversational assistant for Calypso, a web design and development tool.

Classify the user's message into exactly one intent:
- "manage_project": The user wants to work on, modify, open, or navigate to an EXISTING project. This includes adding pages/features/flows to an existing project, designing pages within an existing project, or referencing a project by name. Check the USER'S EXISTING PROJECTS list below.
- "new_project": The user wants to build a NEW web app, site, or product from scratch (e.g., "build me a task manager", "I want to create a SaaS app"). Only use this when they clearly want something NEW, not when they reference an existing project.
- "new_design": The user wants to design a single standalone page or UI outside of any project (e.g., "design a dark mode landing page", "create a hero section"). This is for standalone designs NOT tied to a project.
- "general": Anything else — questions, greetings, unclear requests

USER'S EXISTING PROJECTS:
${projectList}

PROJECT WORKFLOW STEPS:
The tool follows this workflow: features → flows → pages → designs → build
- "features": Define what the app does
- "flows": Map out user journeys and interactions
- "pages": Define the pages/screens and their content
- "designs": AI generates visual HTML designs for each page — this is where pages get visually designed
- "build": AI generates a complete, deployable codebase from the designs

CRITICAL — DISTINGUISHING INTENTS:
- If the user mentions a project by name that EXISTS in the list above → "manage_project" (NOT "new_design" or "new_project")
- "Add a page to my project" / "I want to add a login page to [project name]" → "manage_project"
- "Design the dashboard for my app" when a project exists → "manage_project"
- "Build me a new task manager" when no matching project exists → "new_project"
- "Design a landing page" with no project context → "new_design"
- If ambiguous but the user has projects, lean toward "manage_project" and ask which project they mean.

Respond with ONLY a JSON object, no other text:
{"intent": "<intent>", "name": "<short project/design name>", "description": "<one-sentence description>", "projectId": "<id of existing project if manage_project, otherwise null>", "step": "<target workflow step if manage_project, otherwise null>", "pageName": "<name of the specific page if the user mentions one, otherwise null>", "message": "<your conversational response>", "suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]}

CRITICAL — STEP AND PAGE DETECTION for "manage_project":
- "step" should be the workflow step the user wants to go to. Infer from context:
  * Mentions "design", "designing", "visual", "look" → step: "designs"
  * Mentions "feature", "functionality" → step: "features"
  * Mentions "flow", "user journey" → step: "flows"
  * Mentions "page", "add a page", "content" → step: "pages"
  * Mentions "build", "code", "deploy", "export" → step: "build"
  * If unclear, set step to null
- "pageName" should be the specific page name mentioned (e.g., "create post page" → "Create Post", "dashboard" → "Dashboard", "login page" → "Login"). Use title case. Set to null if no specific page is mentioned.

CRITICAL — CONVERSATIONAL CONTEXT:
You receive the FULL conversation history. You MUST use it to understand what the user means.
- If the conversation has been about a project and the user sends a follow-up like "create the page", "now the design", "add login to it", or "make it dark mode" — interpret this in context of the ongoing discussion. Do NOT treat it as an unrelated or confusing request.
- If the user discussed a project idea and then says "create the page" or "now the page", they likely want a page related to the project. Maintain the same intent (new_project or manage_project) and incorporate the new detail into the description.
- If the user says something vague after a clear project/design discussion, maintain the SAME intent and ask how the new request relates to what was already discussed. Do NOT switch to "general" just because one message is short or ambiguous.
- ALWAYS maintain conversational continuity. Each message builds on the last. A conversation about a "task manager" app followed by "add a calendar view" means the calendar view is part of the task manager — NOT a separate project.
- Update the "name" and "description" fields to reflect the LATEST understanding of the full project/design, incorporating ALL details discussed so far.
- ACTION PHRASES: If the user says "start building", "build it", "let's build", "build everything", "create it", "let's go", "make it", "start designing", "design it", "let's design" — these are commands to CREATE the project/design NOW. Maintain the SAME intent (new_project or new_design) and respond with a short confirmation like "Let's build it!" or "Starting your design!". The suggestions should include the action button (the UI will handle the actual creation).

Rules:
- "message" is ALWAYS required. Keep it to 1-2 sentences. You will receive the full conversation history — use it to build on what was already discussed. NEVER repeat a question already asked. For "new_project"/"new_design", acknowledge new information and ASK a different specific question about scope or functionality — things that affect features, user flows, and pages (e.g., "Should it have user accounts and authentication?", "Do you need an admin dashboard?", "What's the core workflow for users?"). Do NOT ask about visual style — that comes later. For "manage_project", confirm what you'll help with — do NOT ask unnecessary questions when the user's intent is clear. For "general", write a helpful message guiding them. The message MUST end with a question only if the user's intent is unclear.
- "suggestions" is ALWAYS required. Provide 2-3 short suggestions (max 5 words each) that are direct ANSWERS to the question you asked in "message". They should be clickable responses the user can tap to reply.
  - Example: if you ask "Should it have user accounts?", suggestions could be: ["Yes, with social login", "Simple email signup", "No accounts needed"]
  - Example: if you ask "Do you need an admin panel?", suggestions could be: ["Yes, full admin dashboard", "Basic settings only", "Not needed"]
  - For "manage_project": suggestions should be project-relevant actions (e.g., ["Add a new page", "Design the pages", "Add a feature"])
  - For "general": suggest specific project or design ideas (e.g., "Portfolio website", "SaaS dashboard", "E-commerce store")
- "name" and "description" are required for "new_project" and "new_design" intents.
- "projectId" is required for "manage_project" intent — use the ID from the projects list. If the user's message is ambiguous and could refer to multiple projects, ask which one they mean (use "general" intent) and list their projects as suggestions.`;
}

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

    // Fetch the user's existing projects for context
    const userProjects = await db.query.projects.findMany({
      where: and(
        eq(projects.userId, session.user.id),
        ne(projects.status, "archived"),
      ),
      orderBy: [desc(projects.updatedAt)],
      columns: { id: true, name: true, description: true },
      limit: 20,
    });

    // Build full conversation history for context
    const history = parsed.data.history ?? [];
    const messages: { role: "user" | "assistant"; content: string }[] = [
      ...history,
      { role: "user", content: parsed.data.message },
    ];

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 400,
      system: buildSystemPrompt(userProjects),
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
      intent: "new_project" | "new_design" | "manage_project" | "general";
      name?: string;
      description?: string;
      projectId?: string | null;
      step?: string | null;
      pageName?: string | null;
      message?: string;
      suggestions?: string[];
    };

    // For manage_project with a pageName, resolve to a pageId
    if (
      result.intent === "manage_project" &&
      result.projectId &&
      result.pageName
    ) {
      const projectPages = await db.query.pages.findMany({
        where: eq(pages.projectId, result.projectId),
        orderBy: [asc(pages.order)],
        columns: { id: true, title: true },
      });

      // Fuzzy match: case-insensitive substring match
      const targetName = result.pageName.toLowerCase();
      const matched = projectPages.find(
        (p) =>
          p.title.toLowerCase() === targetName ||
          p.title.toLowerCase().includes(targetName) ||
          targetName.includes(p.title.toLowerCase()),
      );

      if (matched) {
        (result as Record<string, unknown>).pageId = matched.id;
      }
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Failed to classify message. Please try again." },
      { status: 500 },
    );
  }
}
