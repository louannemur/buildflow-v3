import { NextResponse } from "next/server";
import { eq, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { db } from "@/lib/db";
import { projects, features, userFlows, pages } from "@/lib/db/schema";
import { createFromChatSchema } from "@/lib/validators/project";
import { getPlanLimits } from "@/lib/plan-limits";
import { getUserPlan, checkUsage, incrementUsage } from "@/lib/usage";

// ─── System prompts (same as individual generate endpoints) ──────────────────

const FEATURES_PROMPT = `You are a product strategist. Given the project name and description, generate 6-10 key features for an MVP.

Each feature should have:
- A clear, concise title (3-6 words)
- A 1-2 sentence description explaining what it does and why it matters

Focus on core MVP features that are essential for launch, not nice-to-haves.

Respond with ONLY a JSON array, no other text:
[{"title": "...", "description": "..."}, ...]`;

const FLOWS_PROMPT = `You are a UX designer. Given the project info and features, generate the key user flows.

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

const PAGES_PROMPT = `You are a product designer. Given the project info, features, and user flows, determine all the pages this application needs.

For each page, provide a title, brief description, and a list of content sections/components the page should contain. Each content item has a name and description.

Be thorough — include auth pages, error pages, settings, dashboard, etc.

Generate 6-15 pages covering the complete application.

Respond with ONLY a JSON array, no other text:
[{"title": "...", "description": "...", "contents": [{"id": "c1", "name": "...", "description": "..."}, ...]}]`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonArray(text: string): unknown[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const arr = JSON.parse(match[0]);
    return Array.isArray(arr) && arr.length > 0 ? arr : null;
  } catch {
    return null;
  }
}

function buildChatContext(
  history: { role: string; content: string }[],
): string {
  return history.map((m) => `${m.role}: ${m.content}`).join("\n");
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createFromChatSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const userId = session.user.id;
    const { name, description, history } = parsed.data;

    // ─── Plan & quota checks ─────────────────────────────────────────────

    const plan = await getUserPlan(userId);
    const limits = getPlanLimits(plan);

    if (limits.maxProjects === 0) {
      return NextResponse.json(
        {
          error: "upgrade_required",
          message:
            "Projects are not available on the Free plan. Upgrade to Studio or higher to create projects.",
        },
        { status: 403 },
      );
    }

    const [{ value: projectCount }] = await db
      .select({ value: count() })
      .from(projects)
      .where(eq(projects.userId, userId));

    if (projectCount >= limits.maxProjects) {
      return NextResponse.json(
        {
          error: "limit_reached",
          message: `You've reached your limit of ${limits.maxProjects} project(s). Upgrade your plan for more.`,
        },
        { status: 403 },
      );
    }

    // Check if user has enough AI generations (need 3)
    const usageCheck = await checkUsage(userId, plan, "ai_generation");
    const hasAiCredits =
      usageCheck.allowed &&
      (usageCheck.limit === Infinity ||
        usageCheck.limit - usageCheck.current >= 3);

    // ─── Create the project ──────────────────────────────────────────────

    const [project] = await db
      .insert(projects)
      .values({ userId, name, description: description ?? null })
      .returning({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        currentStep: projects.currentStep,
      });

    await incrementUsage(userId, "projectsCreated");

    // If not enough AI credits, return the empty project (user can generate manually)
    if (!hasAiCredits) {
      return NextResponse.json(project, { status: 201 });
    }

    // ─── Generate features (first — flows & pages benefit from the context) ─

    const chatContext = buildChatContext(history);
    let baseMessage = `Project: ${name}`;
    if (description) baseMessage += `\nDescription: ${description}`;

    let generatedFeatures: { title: string; description: string }[] = [];

    try {
      const featuresRes = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: FEATURES_PROMPT,
        messages: [
          {
            role: "user",
            content: `${baseMessage}\n\nChat context (conversation between user and assistant about this project):\n${chatContext}`,
          },
        ],
      });

      const featuresText =
        featuresRes.content[0].type === "text"
          ? featuresRes.content[0].text
          : "";
      const featuresArr = parseJsonArray(featuresText) as
        | typeof generatedFeatures
        | null;

      if (featuresArr) {
        generatedFeatures = featuresArr;
        await Promise.all([
          db.insert(features).values(
            generatedFeatures.map((f, i) => ({
              projectId: project.id,
              title: f.title,
              description: f.description,
              order: i,
            })),
          ),
          incrementUsage(userId, "aiGenerations"),
        ]);
      }
    } catch {
      // Feature generation failed — continue with empty features
    }

    // ─── Generate flows + pages in parallel ───────────────────────────────

    const featuresContext =
      generatedFeatures.length > 0
        ? `\n\nFeatures:\n${generatedFeatures.map((f) => `- ${f.title}: ${f.description}`).join("\n")}`
        : "";

    type FlowItem = {
      title: string;
      steps: { id: string; title: string; description: string; type: string }[];
    };
    type PageItem = {
      title: string;
      description: string;
      contents: { id: string; name: string; description: string }[];
    };

    const [flowsResult, pagesResult] = await Promise.allSettled([
      // Flows
      (async () => {
        const flowsRes = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 3000,
          system: FLOWS_PROMPT,
          messages: [
            {
              role: "user",
              content: `${baseMessage}${featuresContext}\n\nChat context:\n${chatContext}`,
            },
          ],
        });
        const text =
          flowsRes.content[0].type === "text" ? flowsRes.content[0].text : "";
        return parseJsonArray(text) as FlowItem[] | null;
      })(),
      // Pages
      (async () => {
        const pagesRes = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 4000,
          system: PAGES_PROMPT,
          messages: [
            {
              role: "user",
              content: `${baseMessage}${featuresContext}\n\nChat context:\n${chatContext}`,
            },
          ],
        });
        const text =
          pagesRes.content[0].type === "text" ? pagesRes.content[0].text : "";
        return parseJsonArray(text) as PageItem[] | null;
      })(),
    ]);

    // ─── Insert flows + pages + update step in parallel ───────────────────

    const dbOps: Promise<unknown>[] = [];

    if (flowsResult.status === "fulfilled" && flowsResult.value) {
      dbOps.push(
        db.insert(userFlows).values(
          flowsResult.value.map((f, i) => ({
            projectId: project.id,
            title: f.title,
            steps: f.steps,
            order: i,
          })),
        ),
        incrementUsage(userId, "aiGenerations"),
      );
    }

    if (pagesResult.status === "fulfilled" && pagesResult.value) {
      dbOps.push(
        db.insert(pages).values(
          pagesResult.value.map((p, i) => ({
            projectId: project.id,
            title: p.title,
            description: p.description,
            contents: p.contents,
            order: i,
          })),
        ),
        incrementUsage(userId, "aiGenerations"),
      );
    }

    dbOps.push(
      db
        .update(projects)
        .set({ currentStep: "designs" })
        .where(eq(projects.id, project.id)),
    );

    await Promise.all(dbOps);

    return NextResponse.json(
      { ...project, currentStep: "designs" },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
