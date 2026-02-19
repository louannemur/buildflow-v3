import { NextResponse } from "next/server";
import { eq, and, asc, count } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { db } from "@/lib/db";
import { features, userFlows, pages, projects } from "@/lib/db/schema";
import { createSSEResponse } from "@/lib/sse";
import type Anthropic from "@anthropic-ai/sdk";

/* ─── Validation ──────────────────────────────────────────────────────────── */

const requestSchema = z.object({
  message: z.string().min(1).max(2000),
  projectId: z.string().uuid(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      }),
    )
    .optional(),
});

/* ─── Tool definitions for Claude ─────────────────────────────────────────── */

const tools: Anthropic.Tool[] = [
  {
    name: "add_feature",
    description:
      "Add a brand new feature to the project. ONLY use this when the user wants a genuinely NEW feature that does not already exist in the project. If a similar feature already exists, use update_feature instead.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Short feature title (e.g. 'User Authentication')",
        },
        description: {
          type: "string",
          description:
            "Feature description explaining what it does and why",
        },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "update_feature",
    description:
      "Update an existing feature's title or description. Use when the user wants to modify, improve, change, or add details to a feature that already exists. Also use this when the user refers to a recently created feature with changes (e.g., 'make it include X', 'add Y to it', 'change that to Z').",
    input_schema: {
      type: "object" as const,
      properties: {
        feature_id: {
          type: "string",
          description: "The ID of the feature to update",
        },
        title: { type: "string", description: "New title (optional)" },
        description: {
          type: "string",
          description: "New description (optional)",
        },
      },
      required: ["feature_id"],
    },
  },
  {
    name: "delete_feature",
    description:
      "Delete a feature from the project. Use when the user wants to remove a feature.",
    input_schema: {
      type: "object" as const,
      properties: {
        feature_id: {
          type: "string",
          description: "The ID of the feature to delete",
        },
      },
      required: ["feature_id"],
    },
  },
  {
    name: "add_flow",
    description:
      "Add a brand new user flow to the project. ONLY use this when the user wants a genuinely NEW flow that does not already exist. If a similar flow already exists, use update_flow instead.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Flow title (e.g. 'User Registration Flow')",
        },
        steps: {
          type: "array",
          description: "Array of flow steps",
          items: {
            type: "object",
            properties: {
              title: { type: "string", description: "Step title" },
              description: {
                type: "string",
                description: "Step description",
              },
              type: {
                type: "string",
                enum: ["action", "decision", "navigation", "input", "display"],
                description: "Step type",
              },
            },
            required: ["title", "description", "type"],
          },
        },
      },
      required: ["title", "steps"],
    },
  },
  {
    name: "update_flow",
    description:
      "Update an existing user flow's title or steps. Use when the user wants to modify, improve, or change a flow that already exists, including when they reference a recently created flow with changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        flow_id: {
          type: "string",
          description: "The ID of the flow to update",
        },
        title: { type: "string", description: "New title (optional)" },
        steps: {
          type: "array",
          description: "New steps array (optional)",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              type: {
                type: "string",
                enum: ["action", "decision", "navigation", "input", "display"],
              },
            },
            required: ["title", "description", "type"],
          },
        },
      },
      required: ["flow_id"],
    },
  },
  {
    name: "delete_flow",
    description:
      "Delete a user flow from the project. Use when the user wants to remove a flow.",
    input_schema: {
      type: "object" as const,
      properties: {
        flow_id: {
          type: "string",
          description: "The ID of the flow to delete",
        },
      },
      required: ["flow_id"],
    },
  },
  {
    name: "add_page",
    description:
      "Add a brand new page to the project. ONLY use this when the user wants a genuinely NEW page that does not already exist. If a similar page already exists, use update_page instead.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description: "Page title (e.g. 'Dashboard', 'Settings')",
        },
        description: {
          type: "string",
          description: "Page description (optional)",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "update_page",
    description:
      "Update an existing page's title or description. Use when the user wants to modify, improve, or change a page that already exists, including when they reference a recently created page with changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: {
          type: "string",
          description: "The ID of the page to update",
        },
        title: { type: "string", description: "New title (optional)" },
        description: {
          type: "string",
          description: "New description (optional)",
        },
      },
      required: ["page_id"],
    },
  },
  {
    name: "delete_page",
    description:
      "Delete a page from the project. Use when the user wants to remove a page.",
    input_schema: {
      type: "object" as const,
      properties: {
        page_id: {
          type: "string",
          description: "The ID of the page to delete",
        },
      },
      required: ["page_id"],
    },
  },
  {
    name: "navigate_to_step",
    description:
      "Navigate the user to a specific project step. Use when the user wants to design pages (navigate to 'designs'), build the project (navigate to 'build'), or go to any other step. For designing a specific page, include the page_id.",
    input_schema: {
      type: "object" as const,
      properties: {
        step: {
          type: "string",
          enum: ["features", "flows", "pages", "designs", "build"],
          description: "The project step to navigate to",
        },
        page_id: {
          type: "string",
          description:
            "Optional: the ID of a specific page to open in the design editor. Only used with step='designs'.",
        },
      },
      required: ["step"],
    },
  },
];

/* ─── System prompt ───────────────────────────────────────────────────────── */

function buildSystemPrompt(
  projectName: string,
  projectDescription: string | null,
  currentFeatures: { id: string; title: string; description: string }[],
  currentFlows: {
    id: string;
    title: string;
    steps: { title: string; description: string; type: string }[];
  }[],
  currentPages: {
    id: string;
    title: string;
    description: string | null;
  }[],
) {
  return `You are Calypso, an AI assistant for a web design and development tool. You are helping the user manage their project.

PROJECT: "${projectName}"
${projectDescription ? `DESCRIPTION: ${projectDescription}` : ""}

CURRENT PROJECT STATE:

Features (${currentFeatures.length}):
${currentFeatures.length > 0 ? currentFeatures.map((f) => `- [${f.id}] ${f.title}: ${f.description}`).join("\n") : "(none)"}

User Flows (${currentFlows.length}):
${currentFlows.length > 0 ? currentFlows.map((f) => `- [${f.id}] ${f.title} (${f.steps.length} steps)`).join("\n") : "(none)"}

Pages (${currentPages.length}):
${currentPages.length > 0 ? currentPages.map((p) => `- [${p.id}] ${p.title}${p.description ? `: ${p.description}` : ""}`).join("\n") : "(none)"}

PROJECT WORKFLOW:
This tool follows a step-by-step workflow: Features → User Flows → Pages → Designs → Build.
- Features: Define what the app does
- User Flows: Map out user journeys and interactions
- Pages: Define the pages/screens and their content
- Designs: AI generates visual HTML designs for each page — this is where pages get designed
- Build: AI generates a complete, deployable codebase from the designs

CRITICAL — UPDATE vs CREATE LOGIC:
Before EVER creating a new item, you MUST check the CURRENT PROJECT STATE above and the conversation history.
- If an item with a similar name or purpose ALREADY EXISTS, UPDATE it instead of creating a duplicate.
- If the user just created something in a recent message and now asks to change/modify/improve it, that is an UPDATE — find the existing item by matching the name or context, and use the update tool with its ID.
- Examples of implicit edit requests (these are NOT requests to create new items):
  * "Make it include social login" → update the most recently discussed feature
  * "Add a description to that" → update the item they just mentioned
  * "Change the name to X" → update the item being discussed
  * "Actually, it should also do Y" → update the item from the previous message
  * "Can you improve that feature?" → update the feature just created/discussed
- Pronouns like "it", "that", "the feature", "the page", "this one" ALWAYS refer to the most recently discussed or created item of that type. Look at conversation history to resolve what they mean.
- NEVER create a duplicate. If you're unsure whether to create or update, ask the user.

CONVERSATIONAL INTELLIGENCE:
You must interpret what the user MEANS, not just what they literally say. Use the full conversation context.
- If the user created a feature and then says "create the page" or "now the page", infer they likely want a page that implements or relates to the feature they just discussed. Ask: "Would you like me to create a page for [feature name]?" or go ahead and create it if the connection is obvious.
- If the user says "add login to it", figure out from context what "it" refers to — it's the most recently discussed feature, flow, or page.
- If the user asks something vague like "what about the dashboard?", check if a Dashboard page/feature exists and ask what they want to do with it — don't just create a new one.
- If the user's message could mean multiple things, pick the most likely interpretation based on conversation context and confirm: "I'll update [item] to include [change] — does that sound right?" Then proceed with the tool call.
- If a request truly doesn't make sense even with context, ask ONE specific clarifying question rather than doing nothing.

INSTRUCTIONS:
- Help the user manage their project by adding, updating, or deleting features, user flows, and pages.
- Use the provided tools to make changes. You can call multiple tools in one response.
- When the user asks to add something genuinely NEW (not a modification of something existing), use the appropriate add tool.
- When the user asks to change/edit/update/improve something, or when they reference a recently created item with modifications, find the matching item by name (or by context from conversation history) and use the update tool with its ID.
- When the user asks to remove/delete something, find the matching item by name and use the delete tool with its ID.
- After making changes, ALWAYS briefly summarize what you did (e.g. "Updated the 'User Authentication' feature to include social login."). The user will be taken to their changes automatically.
- If the user asks something unrelated to project management (like general questions), respond helpfully without using any tools.
- Keep responses concise — 1-3 sentences.
- When adding flows, create meaningful steps with appropriate types (action, decision, navigation, input, display).

NAVIGATION:
- When the user asks to design a page, create a design, generate a design, or anything related to visual design — use navigate_to_step with step="designs". If they mention a specific page, find its ID and include page_id.
- When the user asks to build the project, generate code, or deploy — use navigate_to_step with step="build".
- When the user asks to go to or view features, flows, pages, etc. — use navigate_to_step with the appropriate step.
- NEVER say you cannot create designs or suggest external tools like Figma. You CAN design pages by navigating to the designs step.`;
}

/* ─── Tool execution ──────────────────────────────────────────────────────── */

interface ActionResult {
  tool: string;
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  projectId: string,
): Promise<ActionResult> {
  try {
    switch (toolName) {
      case "add_feature": {
        const [{ value: maxOrder }] = await db
          .select({ value: count() })
          .from(features)
          .where(eq(features.projectId, projectId));
        const [feature] = await db
          .insert(features)
          .values({
            projectId,
            title: input.title as string,
            description: input.description as string,
            order: maxOrder,
          })
          .returning();
        return { tool: toolName, success: true, data: feature as unknown as Record<string, unknown> };
      }

      case "update_feature": {
        const updateData: Record<string, string> = {};
        if (input.title) updateData.title = input.title as string;
        if (input.description)
          updateData.description = input.description as string;
        const [updated] = await db
          .update(features)
          .set(updateData)
          .where(
            and(
              eq(features.id, input.feature_id as string),
              eq(features.projectId, projectId),
            ),
          )
          .returning();
        if (!updated)
          return { tool: toolName, success: false, error: "Feature not found" };
        return { tool: toolName, success: true, data: updated as unknown as Record<string, unknown> };
      }

      case "delete_feature": {
        const [deleted] = await db
          .delete(features)
          .where(
            and(
              eq(features.id, input.feature_id as string),
              eq(features.projectId, projectId),
            ),
          )
          .returning({ id: features.id });
        if (!deleted)
          return { tool: toolName, success: false, error: "Feature not found" };
        return {
          tool: toolName,
          success: true,
          data: { id: deleted.id },
        };
      }

      case "add_flow": {
        const steps = (
          input.steps as { title: string; description: string; type: string }[]
        ).map((s, i) => ({
          id: `step-${Date.now()}-${i}`,
          title: s.title,
          description: s.description,
          type: s.type,
        }));
        const [{ value: maxOrder }] = await db
          .select({ value: count() })
          .from(userFlows)
          .where(eq(userFlows.projectId, projectId));
        const [flow] = await db
          .insert(userFlows)
          .values({
            projectId,
            title: input.title as string,
            steps,
            order: maxOrder,
          })
          .returning();
        return { tool: toolName, success: true, data: flow as unknown as Record<string, unknown> };
      }

      case "update_flow": {
        const flowUpdate: Record<string, unknown> = {};
        if (input.title) flowUpdate.title = input.title as string;
        if (input.steps) {
          flowUpdate.steps = (
            input.steps as {
              title: string;
              description: string;
              type: string;
            }[]
          ).map((s, i) => ({
            id: `step-${Date.now()}-${i}`,
            title: s.title,
            description: s.description,
            type: s.type,
          }));
        }
        const [updatedFlow] = await db
          .update(userFlows)
          .set(flowUpdate)
          .where(
            and(
              eq(userFlows.id, input.flow_id as string),
              eq(userFlows.projectId, projectId),
            ),
          )
          .returning();
        if (!updatedFlow)
          return { tool: toolName, success: false, error: "Flow not found" };
        return { tool: toolName, success: true, data: updatedFlow as unknown as Record<string, unknown> };
      }

      case "delete_flow": {
        const [deletedFlow] = await db
          .delete(userFlows)
          .where(
            and(
              eq(userFlows.id, input.flow_id as string),
              eq(userFlows.projectId, projectId),
            ),
          )
          .returning({ id: userFlows.id });
        if (!deletedFlow)
          return { tool: toolName, success: false, error: "Flow not found" };
        return {
          tool: toolName,
          success: true,
          data: { id: deletedFlow.id },
        };
      }

      case "add_page": {
        const [{ value: maxOrder }] = await db
          .select({ value: count() })
          .from(pages)
          .where(eq(pages.projectId, projectId));
        const [page] = await db
          .insert(pages)
          .values({
            projectId,
            title: input.title as string,
            description: (input.description as string) ?? null,
            contents: [],
            order: maxOrder,
          })
          .returning();
        return { tool: toolName, success: true, data: page as unknown as Record<string, unknown> };
      }

      case "update_page": {
        const pageUpdate: Record<string, unknown> = {};
        if (input.title) pageUpdate.title = input.title as string;
        if (input.description !== undefined)
          pageUpdate.description = input.description as string;
        const [updatedPage] = await db
          .update(pages)
          .set(pageUpdate)
          .where(
            and(
              eq(pages.id, input.page_id as string),
              eq(pages.projectId, projectId),
            ),
          )
          .returning();
        if (!updatedPage)
          return { tool: toolName, success: false, error: "Page not found" };
        return { tool: toolName, success: true, data: updatedPage as unknown as Record<string, unknown> };
      }

      case "delete_page": {
        const [deletedPage] = await db
          .delete(pages)
          .where(
            and(
              eq(pages.id, input.page_id as string),
              eq(pages.projectId, projectId),
            ),
          )
          .returning({ id: pages.id });
        if (!deletedPage)
          return { tool: toolName, success: false, error: "Page not found" };
        return {
          tool: toolName,
          success: true,
          data: { id: deletedPage.id },
        };
      }

      case "navigate_to_step": {
        return {
          tool: toolName,
          success: true,
          data: {
            step: input.step as string,
            page_id: (input.page_id as string) ?? null,
          },
        };
      }

      default:
        return { tool: toolName, success: false, error: "Unknown tool" };
    }
  } catch {
    return { tool: toolName, success: false, error: "Failed to execute action" };
  }
}

/* ─── Route handler ───────────────────────────────────────────────────────── */

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const { message, projectId, history } = parsed.data;

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.userId, session.user.id),
      ),
      columns: { id: true, name: true, description: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    // Fetch current project state
    const [currentFeatures, currentFlows, currentPages] = await Promise.all([
      db.query.features.findMany({
        where: eq(features.projectId, projectId),
        orderBy: [asc(features.order)],
        columns: { id: true, title: true, description: true },
      }),
      db.query.userFlows.findMany({
        where: eq(userFlows.projectId, projectId),
        orderBy: [asc(userFlows.order)],
      }),
      db.query.pages.findMany({
        where: eq(pages.projectId, projectId),
        orderBy: [asc(pages.order)],
        columns: { id: true, title: true, description: true },
      }),
    ]);

    const systemPrompt = buildSystemPrompt(
      project.name,
      project.description,
      currentFeatures,
      currentFlows.map((f) => ({
        id: f.id,
        title: f.title,
        steps: (f.steps as { title: string; description: string; type: string }[]) || [],
      })),
      currentPages,
    );

    // Build conversation
    const messages: Anthropic.MessageParam[] = [
      ...(history ?? []).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      { role: "user", content: message },
    ];

    // Stream the response via SSE
    return createSSEResponse(async (enqueue) => {
      // Phase 1: Stream the initial Claude call — text deltas emit immediately
      const initialStream = anthropic.messages.stream({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages,
      });

      for await (const event of initialStream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          enqueue({ type: "text", text: event.delta.text });
        }
      }

      const response = await initialStream.finalMessage();

      // Execute any tool calls and emit action events
      const actions: ActionResult[] = [];
      const toolUseIds: string[] = [];

      for (const block of response.content) {
        if (block.type === "tool_use") {
          toolUseIds.push(block.id);
          const result = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
            projectId,
          );
          actions.push(result);
          enqueue({ type: "action", action: result });
        }
      }

      // Phase 2: Stream the follow-up summary if tools were used
      if (actions.length > 0) {
        const toolResults: Anthropic.MessageParam = {
          role: "user",
          content: actions.map((a, i) => ({
            type: "tool_result" as const,
            tool_use_id: toolUseIds[i] ?? "",
            content: a.success
              ? JSON.stringify(a.data)
              : `Error: ${a.error}`,
          })),
        };

        const followUpStream = anthropic.messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 300,
          system: systemPrompt,
          tools,
          messages: [...messages, { role: "assistant", content: response.content }, toolResults],
        });

        for await (const event of followUpStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            enqueue({ type: "text", text: event.delta.text });
          }
        }
      }

      enqueue({ type: "done", actions });
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
