import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { mkdtemp, writeFile, mkdir, rm } from "fs/promises";
import { exec } from "child_process";
import { promisify } from "util";
import { auth } from "@/lib/auth";
import { anthropic } from "@/lib/ai";
import { db } from "@/lib/db";
import { stripBfIds } from "@/lib/design/inject-bf-ids";
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
import { getUserPlan, checkUsage, incrementUsage } from "@/lib/usage";
import { z } from "zod";

const execAsync = promisify(exec);
const MAX_FIX_ITERATIONS = 3;

// Allow up to 5 minutes for build + verification on Vercel
export const maxDuration = 300;

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

/* ─── Build verification helpers ─────────────────────────────────────────── */

async function writeFilesToTemp(files: BuildFile[]): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "calypso-build-"));
  for (const file of files) {
    const filePath = join(tempDir, file.path);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, file.content, "utf-8");
  }
  return tempDir;
}

async function runBuild(
  tempDir: string,
): Promise<{ success: boolean; errors: string; infra?: boolean }> {
  try {
    await execAsync(
      "npm install --legacy-peer-deps --no-audit --no-fund --loglevel=error",
      { cwd: tempDir, timeout: 120_000 },
    );
    await execAsync("npm run build", {
      cwd: tempDir,
      timeout: 120_000,
    });
    return { success: true, errors: "" };
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const msg = e.message ?? "";
    // Infrastructure errors (npm not available, disk full, etc.)
    if (
      msg.includes("ENOENT") ||
      msg.includes("command not found") ||
      msg.includes("ENOSPC") ||
      msg.includes("ENOMEM")
    ) {
      return { success: false, errors: msg, infra: true };
    }
    const errors = [e.stderr, e.stdout].filter(Boolean).join("\n");
    return { success: false, errors };
  }
}

async function cleanupTemp(dir: string) {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // Best effort
  }
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

  // Tech stack + framework-specific version guidance
  const nextjsRules = `
- Use Next.js 15 (latest stable). In package.json: "next": "^15.1.0", "react": "^19.0.0", "react-dom": "^19.0.0"
- Use Next.js App Router with server and client components
- Config file MUST be named next.config.mjs (ESM, NOT .ts and NOT .js). Example:
  /** @type {import('next').NextConfig} */
  const nextConfig = {};
  export default nextConfig;
- Every component that uses hooks (useState, useEffect, etc.), event handlers (onClick, onChange, etc.), or browser APIs MUST have "use client" at the top
- Do NOT import from "next/router" — use "next/navigation" instead (useRouter, usePathname, useSearchParams)
- For images, use next/image with width and height props, OR use regular <img> tags
- Do NOT use the experimental "appDir" option — App Router is the default in Next.js 15`;

  const viteRules = `
- Use Vite 6 with React 19. In package.json: "vite": "^6.0.0", "react": "^19.0.0", "react-dom": "^19.0.0", "@vitejs/plugin-react": "^4.3.0"
- Config file: vite.config.${opts.includeTypeScript ? "ts" : "js"}`;

  const frameworkRules =
    opts.framework === "nextjs"
      ? nextjsRules
      : opts.framework === "vite_react"
        ? viteRules
        : "";

  const tailwindRules =
    opts.styling === "tailwind"
      ? opts.framework === "nextjs"
        ? `\n- Use Tailwind CSS v4. In package.json: "tailwindcss": "^4.0.0", "@tailwindcss/postcss": "^4.0.0"
- postcss.config.mjs should use @tailwindcss/postcss plugin
- In the global CSS file, use @import "tailwindcss" (Tailwind v4 syntax, NOT @tailwind directives)
- Do NOT create a tailwind.config.js/ts file — Tailwind v4 uses CSS-based configuration
- Configure Tailwind theme in CSS using @theme { } blocks in the global CSS file`
        : `\n- Configure Tailwind CSS properly with the project's color palette`
      : "";

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
- Include package.json with all required dependencies and correct version numbers
- The project MUST build successfully with "npm install && npm run build" — no errors allowed
- Do NOT use deprecated APIs or outdated package versions${frameworkRules}${tailwindRules}

DEPENDENCY VERSION RULES (React 19 compatibility):
- ALL npm packages must be compatible with React 19. Use the LATEST versions of every library.
- lucide-react: use "^0.460.0" or later (NOT 0.263.x which only supports React 18)
- framer-motion: use "^12.0.0" or later
- @radix-ui/*: use the latest versions (all support React 19)
- react-hook-form: use "^7.54.0" or later
- @headlessui/react: use "^2.2.0" or later
- react-icons: use "^5.4.0" or later
- clsx: use "^2.1.0"
- class-variance-authority: use "^0.7.1"
- tailwind-merge: use "^2.6.0"
- zod: use "^3.24.0"
- Do NOT use any package version that has peer dependency requirements for react@"^16" or react@"^17" or react@"^18" only
- When in doubt, use the LATEST stable version of any package — never use old/outdated versions
- Generate an .npmrc file with: legacy-peer-deps=true

CRITICAL BUILD RULES:
- Every JSX/TSX file must have valid syntax — no unclosed tags, no missing return statements
- Every import must reference a file/package that exists in the project
- package.json must include ALL dependencies used in source files
- tsconfig.json must have correct paths and compiler options for the chosen framework
- All config files must use the correct file extension and syntax for the framework version

OUTPUT FORMAT:
Return your response as a series of files. For each file, use this exact format:

===FILE: path/to/file.${ext}===
file content here
===END FILE===

Generate ALL files needed for a complete, runnable project. Include config files (${opts.framework === "nextjs" ? "next.config.mjs, tsconfig.json, postcss.config.mjs" : opts.framework === "vite_react" ? `vite.config.${opts.includeTypeScript ? "ts" : "js"}, tsconfig.json` : "index.html"}), package.json, README.md, and all source files.`);

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
    const plan = await getUserPlan(userId);

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
      pages: projectPages.map((p) => {
        const rawHtml = designByPageId.get(p.id)?.html || null;
        return {
          title: p.title,
          description: p.description,
          contents: p.contents,
          designHtml: rawHtml ? stripBfIds(rawHtml) : null,
        };
      }),
      styleGuide: styleGuide
        ? { ...styleGuide, html: stripBfIds(styleGuide.html) }
        : null,
    });

    // Stream from Anthropic with incremental file parsing
    const encoder = new TextEncoder();
    const buildOutputId = buildOutput.id;
    const buildStartTime = Date.now();
    // Graceful deadline: abort AI stream 30s before maxDuration to allow saving
    const gracefulDeadline = buildStartTime + (maxDuration - 30) * 1000;

    const readable = new ReadableStream({
      async start(controller) {
        let savedAsComplete = false;
        let savedFiles: BuildFile[] = [];
        try {
          const stream = anthropic.messages.stream({
            model: "claude-opus-4-20250514",
            max_tokens: 32000,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content:
                  "Generate the complete project now. Output ALL files using the ===FILE: path=== format. No explanation outside of file markers. The project MUST compile and build successfully — double-check every file for valid syntax, correct imports, and proper configuration before outputting it. IMPORTANT: All npm packages must use their LATEST versions that are compatible with React 19. Do NOT use outdated package versions. Include an .npmrc file with legacy-peer-deps=true.",
              },
            ],
          });

          let accumulated = "";
          let scanPos = 0;
          let currentFilePath: string | null = null;
          let fileStartContentPos = 0;
          const completedFiles: BuildFile[] = [];
          let hitDeadline = false;

          const FILE_START = /===FILE:\s*(.+?)===\n/g;
          const FILE_END = "===END FILE===";

          function emit(event: Record<string, unknown>) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
            );
          }

          stream.on("text", (delta) => {
            accumulated += delta;

            // Check if we're approaching the function timeout
            if (Date.now() > gracefulDeadline && !hitDeadline) {
              hitDeadline = true;
              stream.abort();
              return;
            }

            // Scan for file markers from our last known position
            while (scanPos < accumulated.length) {
              if (currentFilePath === null) {
                // Looking for ===FILE: path===
                FILE_START.lastIndex = scanPos;
                const startMatch = FILE_START.exec(accumulated);
                if (startMatch) {
                  currentFilePath = startMatch[1].trim();
                  fileStartContentPos = startMatch.index + startMatch[0].length;
                  scanPos = fileStartContentPos;
                  emit({ type: "file_start", path: currentFilePath });
                } else {
                  // No complete marker yet — wait for more data
                  // But only wait if we might have a partial marker
                  const partialIdx = accumulated.indexOf("===", scanPos);
                  if (partialIdx === -1) {
                    scanPos = accumulated.length;
                  } else {
                    scanPos = partialIdx;
                  }
                  break;
                }
              } else {
                // Inside a file — look for ===END FILE===
                const endIdx = accumulated.indexOf(FILE_END, scanPos);
                if (endIdx !== -1) {
                  const content = accumulated
                    .slice(fileStartContentPos, endIdx)
                    .trimEnd();
                  completedFiles.push({
                    path: currentFilePath,
                    content,
                  });

                  // Persist every completed file to DB — survives function timeouts
                  db.update(buildOutputs)
                    .set({ files: [...completedFiles] })
                    .where(eq(buildOutputs.id, buildOutputId))
                    .catch(() => {});

                  emit({
                    type: "file_complete",
                    path: currentFilePath,
                    content,
                  });
                  scanPos = endIdx + FILE_END.length;
                  currentFilePath = null;
                } else {
                  // Stream chunk of the current file
                  const safeEnd =
                    accumulated.length - FILE_END.length - 1;
                  if (safeEnd > scanPos) {
                    const chunk = accumulated.slice(scanPos, safeEnd);
                    if (chunk.length > 0) {
                      emit({
                        type: "file_chunk",
                        path: currentFilePath,
                        text: chunk,
                      });
                    }
                    scanPos = safeEnd;
                  }
                  break;
                }
              }
            }
          });

          // Wait for the stream to complete (or deadline abort)
          try {
            await stream.finalMessage();
          } catch (streamErr) {
            // If we aborted due to deadline, continue with what we have
            if (!hitDeadline) throw streamErr;
          }

          // Handle truncated last file (max_tokens reached or deadline abort)
          if (currentFilePath) {
            const content = accumulated
              .slice(fileStartContentPos)
              .trimEnd();
            if (content) {
              completedFiles.push({ path: currentFilePath, content });
              emit({
                type: "file_complete",
                path: currentFilePath,
                content,
              });
            }
          }

          if (completedFiles.length === 0) {
            await db
              .update(buildOutputs)
              .set({
                status: "failed",
                error: "No files parsed from AI response",
              })
              .where(eq(buildOutputs.id, buildOutputId));

            emit({
              type: "error",
              message: "Failed to generate project files. Please try again.",
            });
            controller.close();
            return;
          }

          // ─── Save to DB immediately (before verification) ─────────
          // This ensures the build is available for download/publish
          // even if the verification step times out on serverless.
          await db
            .update(buildOutputs)
            .set({ status: "complete", files: completedFiles })
            .where(eq(buildOutputs.id, buildOutputId));
          savedAsComplete = true;
          savedFiles = completedFiles;

          // ─── Build verification loop ─────────────────────────────
          // Skip for static HTML projects (no build step)
          // Also skip if approaching function timeout
          let finalFiles = completedFiles;
          const skipVerification = hitDeadline || Date.now() > gracefulDeadline;

          if (parsed.data.framework !== "html" && !skipVerification) {
            const currentFiles = [...completedFiles];
            let buildPassed = false;

            for (
              let iteration = 0;
              iteration < MAX_FIX_ITERATIONS;
              iteration++
            ) {
              let tempDir: string | null = null;
              try {
                emit({
                  type: "verify",
                  message:
                    iteration === 0
                      ? "Installing dependencies..."
                      : "Re-checking build...",
                  iteration: iteration + 1,
                });

                tempDir = await writeFilesToTemp(currentFiles);

                emit({
                  type: "verify",
                  message: "Running build...",
                  iteration: iteration + 1,
                });

                const result = await runBuild(tempDir);
                await cleanupTemp(tempDir);
                tempDir = null;

                if (result.success) {
                  emit({
                    type: "verify",
                    message: "Build passed!",
                    iteration: iteration + 1,
                  });
                  finalFiles = currentFiles;
                  buildPassed = true;
                  break;
                }

                // Infrastructure error — skip verification entirely
                if (result.infra) {
                  console.warn(
                    "Build verification unavailable:",
                    result.errors,
                  );
                  finalFiles = currentFiles;
                  buildPassed = true; // Treat as pass — can't verify
                  break;
                }

                // Build failed with code errors
                // Truncate error output for the SSE event and AI context
                const truncatedErrors = result.errors.slice(0, 4000);

                emit({
                  type: "verify_failed",
                  errors: truncatedErrors.slice(0, 1500),
                  iteration: iteration + 1,
                  maxIterations: MAX_FIX_ITERATIONS,
                });

                // Last iteration — keep what we have
                if (iteration === MAX_FIX_ITERATIONS - 1) {
                  finalFiles = currentFiles;
                  break;
                }

                // Ask AI to fix the errors
                emit({
                  type: "fixing",
                  iteration: iteration + 1,
                });

                const fixResponse = await anthropic.messages.create({
                  model: "claude-sonnet-4-20250514",
                  max_tokens: 32000,
                  system: `You are an expert developer. You will be given a project that failed to build along with the build error output. Fix ONLY the files that have errors. Output each fixed file using this exact format:\n\n===FILE: path/to/file===\nfixed content\n===END FILE===\n\nDo NOT output files that don't need changes. Do NOT add explanations outside of file markers.`,
                  messages: [
                    {
                      role: "user",
                      content: `BUILD ERRORS:\n\n${truncatedErrors}\n\nPROJECT FILES:\n\n${currentFiles.map((f) => `===FILE: ${f.path}===\n${f.content}\n===END FILE===`).join("\n\n")}\n\nFix the build errors. Output ONLY the changed files.`,
                    },
                  ],
                });

                const fixText =
                  fixResponse.content[0].type === "text"
                    ? fixResponse.content[0].text
                    : "";
                const fixedFiles = parseFilesFromResponse(fixText);

                if (fixedFiles.length === 0) {
                  // AI couldn't produce fixes — stop iterating
                  finalFiles = currentFiles;
                  break;
                }

                // Merge fixed files and emit updates
                for (const fixed of fixedFiles) {
                  const idx = currentFiles.findIndex(
                    (f) => f.path === fixed.path,
                  );
                  if (idx >= 0) currentFiles[idx] = fixed;
                  else currentFiles.push(fixed);

                  emit({
                    type: "file_complete",
                    path: fixed.path,
                    content: fixed.content,
                  });
                }
              } catch (verifyErr) {
                console.error("Build verification error:", verifyErr);
                if (tempDir) await cleanupTemp(tempDir);
                finalFiles = currentFiles;
                break;
              }
            }

            if (!buildPassed) {
              emit({
                type: "verify",
                message:
                  "Could not fully resolve build errors — files may need manual fixes.",
              });
            }
          }

          // ─── Update DB if verification improved files ────────────

          if (finalFiles !== completedFiles) {
            await db
              .update(buildOutputs)
              .set({ files: finalFiles })
              .where(eq(buildOutputs.id, buildOutputId));
          }

          try {
            await incrementUsage(userId, "aiGenerations");
          } catch (usageErr) {
            console.error("Failed to increment usage:", usageErr);
            // Non-fatal — don't block the build result
          }

          emit({
            type: "done",
            buildId: buildOutputId,
            files: finalFiles,
            fileCount: finalFiles.length,
          });

          controller.close();
        } catch (error) {
          console.error("Build stream error:", error);
          const message =
            error instanceof Error ? error.message : "Something went wrong.";

          try {
            // Only mark as failed if we haven't already saved a complete build.
            // Errors during verification or usage tracking shouldn't erase
            // a successfully generated build.
            if (!savedAsComplete) {
              await db
                .update(buildOutputs)
                .set({ status: "failed", error: message })
                .where(eq(buildOutputs.id, buildOutputId));
            }
          } catch {
            // DB update failed, not critical
          }

          // If the build was already saved, still try to send the done event
          // so the client gets the build ID for preview/publish/download.
          if (savedAsComplete) {
            try {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "done", buildId: buildOutputId, files: savedFiles, fileCount: savedFiles.length })}\n\n`,
                ),
              );
            } catch {
              // Client may have disconnected
            }
          } else {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: `Build failed: ${message}` })}\n\n`,
              ),
            );
          }
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Build error:", error);
    const message =
      error instanceof Error ? error.message : "Something went wrong.";
    return NextResponse.json(
      { error: `Build failed: ${message}` },
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
  } catch (error) {
    console.error("Build GET error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
