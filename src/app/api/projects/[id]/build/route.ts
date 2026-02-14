import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { db } from "@/lib/db";
import {
  projects,
  features,
  userFlows,
  pages,
  designs,
  buildConfigs,
  buildOutputs,
  type BuildFile,
} from "@/lib/db/schema";
import { checkUsage, incrementUsage } from "@/lib/usage";
import type { Plan } from "@/lib/plan-limits";
import { z } from "zod";

/* ─── Validation ─────────────────────────────────────────────────────────── */

const buildSchema = z.object({
  framework: z.enum(["nextjs", "vite_react", "html"]),
  styling: z.enum(["tailwind", "css", "scss"]),
  includeTypeScript: z.boolean(),
});

/* ─── Parse AI response into files ───────────────────────────────────────── */

function parseFilesFromResponse(text: string): BuildFile[] {
  const files: BuildFile[] = [];
  const fileRegex = /===FILE:\s*(.+?)===\n([\s\S]*?)===END FILE===/g;
  let match;

  while ((match = fileRegex.exec(text)) !== null) {
    const path = match[1].trim();
    const content = match[2].trimEnd();
    if (path && content) {
      files.push({ path, content });
    }
  }

  return files;
}

/* ─── Build system prompt ────────────────────────────────────────────────── */

function buildSystemPrompt(opts: {
  projectName: string;
  projectDescription: string | null;
  framework: string;
  styling: string;
  includeTypeScript: boolean;
  features: { title: string; description: string }[];
  flows: { title: string; steps: { title: string; description: string }[] }[];
  pages: {
    title: string;
    description: string | null;
    contents: { name: string; description: string }[] | null;
    designHtml: string | null;
  }[];
  styleGuide: {
    html: string;
    fonts: Record<string, string> | null;
    colors: Record<string, string> | null;
  } | null;
}): string {
  const frameworkLabel =
    opts.framework === "nextjs"
      ? "Next.js (App Router)"
      : opts.framework === "vite_react"
        ? "Vite + React"
        : "HTML/CSS/JS";

  const stylingLabel =
    opts.styling === "tailwind"
      ? "Tailwind CSS"
      : opts.styling === "css"
        ? "CSS Modules"
        : "SCSS/Sass";

  const ext = opts.includeTypeScript ? "tsx" : "jsx";
  const tsLabel = opts.includeTypeScript ? "Yes" : "No";

  const parts: string[] = [
    `You are an expert full-stack developer. Generate a complete, production-ready ${frameworkLabel} project based on the following specification.

PROJECT: ${opts.projectName}${opts.projectDescription ? ` — ${opts.projectDescription}` : ""}`,
  ];

  // Features
  if (opts.features.length > 0) {
    parts.push(
      `\nFEATURES:\n${opts.features.map((f) => `- ${f.title}: ${f.description}`).join("\n")}`,
    );
  }

  // Flows
  if (opts.flows.length > 0) {
    parts.push(
      `\nUSER FLOWS:\n${opts.flows
        .map(
          (f) =>
            `Flow: ${f.title}\n${f.steps.map((s, i) => `  ${i + 1}. ${s.title}: ${s.description}`).join("\n")}`,
        )
        .join("\n\n")}`,
    );
  }

  // Pages with designs
  const pagesWithDesigns = opts.pages.filter((p) => p.designHtml);
  const pagesWithoutDesigns = opts.pages.filter((p) => !p.designHtml);

  if (opts.pages.length > 0) {
    parts.push(`\nPAGES:`);

    for (const page of opts.pages) {
      let pageStr = `\nPAGE: ${page.title}`;
      if (page.description) pageStr += `\nDescription: ${page.description}`;
      if (page.contents && page.contents.length > 0) {
        pageStr += `\nContent sections:\n${page.contents.map((c) => `  - ${c.name}: ${c.description}`).join("\n")}`;
      }
      parts.push(pageStr);
    }
  }

  if (pagesWithDesigns.length > 0) {
    parts.push(
      `\nDESIGNS:\nThe following HTML designs should be converted into ${frameworkLabel} components while preserving the visual design exactly:`,
    );

    for (const page of pagesWithDesigns) {
      parts.push(`\nPAGE: ${page.title}\n\`\`\`html\n${page.designHtml}\n\`\`\``);
    }
  }

  if (pagesWithoutDesigns.length > 0) {
    parts.push(
      `\nPages without designs (create a clean, professional design for these): ${pagesWithoutDesigns.map((p) => p.title).join(", ")}`,
    );
  }

  // Style guide
  if (opts.styleGuide) {
    parts.push(
      `\nSTYLE GUIDE: Match the visual style of the style guide design across all pages.${opts.styleGuide.fonts ? `\nFonts: ${JSON.stringify(opts.styleGuide.fonts)}` : ""}${opts.styleGuide.colors ? `\nColors: ${JSON.stringify(opts.styleGuide.colors)}` : ""}`,
    );
  }

  // Tech stack
  parts.push(`
TECH STACK:
- Framework: ${frameworkLabel}
- Styling: ${stylingLabel}
- TypeScript: ${tsLabel}

REQUIREMENTS:
- Generate a complete project with proper file structure
- Convert all HTML designs into proper ${frameworkLabel} components
- Preserve the exact visual design from the HTML (colors, fonts, spacing, layout)
- Create proper routing/navigation between pages
- Include realistic placeholder data
${opts.includeTypeScript ? "- Add proper TypeScript types for all components and data" : ""}
- Include a README.md with setup instructions
- Include package.json with all dependencies
- Make it production-ready and runnable with a single command
${opts.framework === "nextjs" ? "- Use Next.js App Router with server and client components" : ""}
${opts.styling === "tailwind" ? "- Configure Tailwind CSS properly with the project's color palette" : ""}

OUTPUT FORMAT:
Return your response as a series of files. For each file, use this exact format:

===FILE: path/to/file.${ext}===
file content here
===END FILE===

Generate ALL files needed for a complete, runnable project. Include config files (${opts.framework === "nextjs" ? "next.config.ts, tsconfig.json" : opts.framework === "vite_react" ? "vite.config.ts, tsconfig.json" : "index.html"}), package.json, README.md, and all source files.`);

  return parts.join("\n");
}

/* ─── POST: Start build ──────────────────────────────────────────────────── */

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const userId = session.user.id;
    const plan = (session.user.plan ?? "free") as Plan;

    // Tier check: Pro or Founding only
    if (plan === "free" || plan === "studio") {
      return NextResponse.json(
        {
          error: "upgrade_required",
          message:
            "Building projects requires a Pro or Founding plan. Upgrade to generate your full codebase.",
        },
        { status: 403 },
      );
    }

    // Check AI usage limits
    const usageCheck = await checkUsage(userId, plan, "ai_generation");
    if (!usageCheck.allowed) {
      return NextResponse.json(
        { error: "limit_reached", message: usageCheck.message },
        { status: 403 },
      );
    }

    const body = await req.json();
    const parsed = buildSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
      columns: { id: true, name: true, description: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    // Upsert build config
    const [config] = await db
      .insert(buildConfigs)
      .values({
        projectId,
        framework: parsed.data.framework,
        styling: parsed.data.styling,
        includeTypeScript: parsed.data.includeTypeScript,
      })
      .onConflictDoUpdate({
        target: buildConfigs.projectId,
        set: {
          framework: parsed.data.framework,
          styling: parsed.data.styling,
          includeTypeScript: parsed.data.includeTypeScript,
        },
      })
      .returning({ id: buildConfigs.id });

    // Create build output record
    const [buildOutput] = await db
      .insert(buildOutputs)
      .values({
        projectId,
        buildConfigId: config.id,
        status: "generating",
      })
      .returning({ id: buildOutputs.id });

    // Fetch all project data
    const [projectFeatures, projectFlows, projectPages, projectDesigns] =
      await Promise.all([
        db.query.features.findMany({
          where: eq(features.projectId, projectId),
          columns: { title: true, description: true },
        }),
        db.query.userFlows.findMany({
          where: eq(userFlows.projectId, projectId),
          columns: { title: true, steps: true },
        }),
        db.query.pages.findMany({
          where: eq(pages.projectId, projectId),
          columns: {
            id: true,
            title: true,
            description: true,
            contents: true,
          },
          orderBy: [pages.order],
        }),
        db.query.designs.findMany({
          where: eq(designs.projectId, projectId),
          columns: {
            pageId: true,
            html: true,
            isStyleGuide: true,
            fonts: true,
            colors: true,
          },
        }),
      ]);

    // Map designs to pages
    const designByPageId = new Map(
      projectDesigns
        .filter((d) => d.pageId)
        .map((d) => [d.pageId!, d]),
    );

    // Find style guide
    const styleGuideDesign = projectDesigns.find((d) => d.isStyleGuide);
    const styleGuide =
      styleGuideDesign && styleGuideDesign.html
        ? {
            html: styleGuideDesign.html,
            fonts: styleGuideDesign.fonts as Record<string, string> | null,
            colors: styleGuideDesign.colors as Record<string, string> | null,
          }
        : null;

    // Build prompt
    const systemPrompt = buildSystemPrompt({
      projectName: project.name,
      projectDescription: project.description,
      framework: parsed.data.framework,
      styling: parsed.data.styling,
      includeTypeScript: parsed.data.includeTypeScript,
      features: projectFeatures,
      flows: projectFlows.map((f) => ({
        title: f.title,
        steps: (f.steps ?? []).map((s) => ({
          title: s.title,
          description: s.description,
        })),
      })),
      pages: projectPages.map((p) => ({
        title: p.title,
        description: p.description,
        contents: p.contents,
        designHtml: designByPageId.get(p.id)?.html || null,
      })),
      styleGuide,
    });

    // Call Anthropic
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content:
            "Generate the complete project now. Output ALL files using the ===FILE: path=== format. No explanation outside of file markers.",
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (!text.trim()) {
      await db
        .update(buildOutputs)
        .set({ status: "failed", error: "No response from AI" })
        .where(eq(buildOutputs.id, buildOutput.id));

      return NextResponse.json(
        { error: "Failed to generate project. Please try again." },
        { status: 500 },
      );
    }

    // Parse files
    const files = parseFilesFromResponse(text);

    if (files.length === 0) {
      await db
        .update(buildOutputs)
        .set({
          status: "failed",
          error: "Could not parse files from AI response",
        })
        .where(eq(buildOutputs.id, buildOutput.id));

      return NextResponse.json(
        { error: "Failed to parse generated files. Please try again." },
        { status: 500 },
      );
    }

    // Save files and mark complete
    await db
      .update(buildOutputs)
      .set({ status: "complete", files })
      .where(eq(buildOutputs.id, buildOutput.id));

    // Increment AI usage
    await incrementUsage(userId, "aiGenerations");

    return NextResponse.json(
      {
        id: buildOutput.id,
        status: "complete",
        files,
        fileCount: files.length,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

/* ─── GET: Get latest build output ───────────────────────────────────────── */

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify ownership
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.userId, session.user.id),
      ),
      columns: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    // Get latest build output
    const output = await db.query.buildOutputs.findFirst({
      where: eq(buildOutputs.projectId, projectId),
      orderBy: [desc(buildOutputs.createdAt)],
      with: {
        buildConfig: true,
      },
    });

    if (!output) {
      return NextResponse.json({ output: null }, { status: 200 });
    }

    return NextResponse.json({ output }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
