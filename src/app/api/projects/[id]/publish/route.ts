import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  projects,
  buildOutputs,
  buildConfigs,
  publishedSites,
} from "@/lib/db/schema";
import { getUserPlan } from "@/lib/usage";

const PUBLISH_DOMAIN = process.env.PUBLISH_DOMAIN || "calypso.build";

/* ─── Slug helpers ─────────────────────────────────────────────────────────── */

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

async function uniqueSlug(base: string, projectId: string): Promise<string> {
  // Check if this project already has a slug
  const existing = await db.query.publishedSites.findFirst({
    where: eq(publishedSites.projectId, projectId),
    columns: { slug: true },
  });
  if (existing) return existing.slug;

  // Try the base slug first
  let candidate = base || "project";
  const taken = await db.query.publishedSites.findFirst({
    where: eq(publishedSites.slug, candidate),
    columns: { id: true },
  });

  if (!taken) return candidate;

  // Append short hash from projectId
  candidate = `${base}-${projectId.slice(0, 6)}`;
  const taken2 = await db.query.publishedSites.findFirst({
    where: eq(publishedSites.slug, candidate),
    columns: { id: true },
  });

  if (!taken2) return candidate;

  // Fallback: use full prefix of projectId
  return `${base}-${projectId.slice(0, 12)}`;
}

/* ─── POST: Publish or re-publish ──────────────────────────────────────────── */

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const userId = session.user.id;

    // Plan check: Pro or Founding only
    const plan = await getUserPlan(userId);
    if (plan !== "pro" && plan !== "founding") {
      return NextResponse.json(
        {
          error: "upgrade_required",
          message:
            "Publishing requires a Pro or Founding plan. Upgrade to publish your site.",
        },
        { status: 403 },
      );
    }

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
      columns: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    // Get latest complete build
    const output = await db.query.buildOutputs.findFirst({
      where: and(
        eq(buildOutputs.projectId, projectId),
        eq(buildOutputs.status, "complete"),
      ),
      orderBy: [desc(buildOutputs.createdAt)],
      columns: { id: true, files: true },
    });

    if (!output?.files || output.files.length === 0) {
      return NextResponse.json(
        { error: "No completed build found. Build your project first." },
        { status: 404 },
      );
    }

    // Get framework for Vercel project settings
    const config = await db.query.buildConfigs.findFirst({
      where: eq(buildConfigs.projectId, projectId),
      columns: { framework: true },
    });

    let framework: string | null = null;
    if (config) {
      switch (config.framework) {
        case "nextjs":
          framework = "nextjs";
          break;
        case "vite_react":
          framework = "vite";
          break;
        default:
          framework = null;
      }
    }

    // Platform Vercel token
    const token = process.env.VERCEL_PUBLISH_TOKEN;
    if (!token) {
      console.error("VERCEL_PUBLISH_TOKEN not configured");
      return NextResponse.json(
        {
          error:
            "Publishing is not available right now. Please try again later.",
        },
        { status: 503 },
      );
    }

    const teamId = process.env.VERCEL_TEAM_ID;
    const teamQuery = teamId ? `?teamId=${teamId}` : "";

    // Check for existing publish (re-publish case)
    const existingPublish = await db.query.publishedSites.findFirst({
      where: eq(publishedSites.projectId, projectId),
    });

    // Generate unique slug for custom domain
    const slug = await uniqueSlug(slugify(project.name), projectId);
    const customDomain = `${slug}.${PUBLISH_DOMAIN}`;
    const customUrl = `https://${customDomain}`;

    // Deterministic Vercel project name
    const vercelProjectName = `calypso-${projectId.slice(0, 8)}`;

    // Upload files to Vercel
    const files = output.files as { path: string; content: string }[];
    const fileRefs: { file: string; sha: string; size: number }[] = [];

    for (const file of files) {
      const content = Buffer.from(file.content, "utf-8");
      const sha = createHash("sha1").update(content).digest("hex");

      const uploadRes = await fetch(
        `https://api.vercel.com/v2/files${teamQuery}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/octet-stream",
            "Content-Length": String(content.length),
            "x-vercel-digest": sha,
          },
          body: content,
        },
      );

      // 409 = file already exists (same hash) — that's fine
      if (!uploadRes.ok && uploadRes.status !== 409) {
        console.error("Publish file upload failed:", uploadRes.status);

        if (uploadRes.status === 401 || uploadRes.status === 403) {
          return NextResponse.json(
            {
              error:
                "Publishing service configuration error. Please contact support.",
            },
            { status: 500 },
          );
        }

        return NextResponse.json(
          { error: "Failed to publish. Please try again." },
          { status: 500 },
        );
      }

      fileRefs.push({ file: file.path, sha, size: content.length });
    }

    // Create deployment
    const deployRes = await fetch(
      `https://api.vercel.com/v13/deployments${teamQuery}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: vercelProjectName,
          files: fileRefs,
          projectSettings: { framework },
          target: "production",
        }),
      },
    );

    if (!deployRes.ok) {
      const errData = await deployRes.json().catch(() => ({}));
      console.error("Publish deployment failed:", deployRes.status, errData);
      return NextResponse.json(
        {
          error:
            errData?.error?.message ||
            "Publishing failed. Please try again.",
        },
        { status: 500 },
      );
    }

    const deployment = await deployRes.json();
    const vercelProjectId = deployment.projectId ?? vercelProjectName;

    // Assign custom domain to the Vercel project
    // This adds slug.calypso.build as a domain on the project
    try {
      const domainRes = await fetch(
        `https://api.vercel.com/v10/projects/${vercelProjectId}/domains${teamQuery}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name: customDomain }),
        },
      );

      // 409 = domain already assigned (fine for re-publish)
      if (!domainRes.ok && domainRes.status !== 409) {
        const domainErr = await domainRes.json().catch(() => ({}));
        console.error(
          "Domain assignment failed:",
          domainRes.status,
          domainErr,
        );
        // Don't fail the publish — fall back to Vercel URL
      }
    } catch (err) {
      console.error("Domain assignment error:", err);
      // Non-fatal — site is still accessible via Vercel URL
    }

    // Upsert published_sites record
    if (existingPublish) {
      await db
        .update(publishedSites)
        .set({
          buildOutputId: output.id,
          vercelProjectId,
          vercelDeploymentId: deployment.id,
          url: customUrl,
          status: "ready",
          publishedAt: new Date(),
        })
        .where(eq(publishedSites.id, existingPublish.id));
    } else {
      await db.insert(publishedSites).values({
        projectId,
        buildOutputId: output.id,
        slug,
        vercelProjectId,
        vercelDeploymentId: deployment.id,
        url: customUrl,
        status: "ready",
      });
    }

    return NextResponse.json({
      url: customUrl,
      slug,
      deploymentId: deployment.id,
    });
  } catch (error) {
    console.error("Publish error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

/* ─── GET: Check publish status ────────────────────────────────────────────── */

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

    const site = await db.query.publishedSites.findFirst({
      where: eq(publishedSites.projectId, projectId),
    });

    if (!site || site.status === "deleted") {
      return NextResponse.json({ published: false });
    }

    // Check if the published build is current
    const latestBuild = await db.query.buildOutputs.findFirst({
      where: and(
        eq(buildOutputs.projectId, projectId),
        eq(buildOutputs.status, "complete"),
      ),
      orderBy: [desc(buildOutputs.createdAt)],
      columns: { id: true },
    });

    const isStale = latestBuild ? latestBuild.id !== site.buildOutputId : false;

    return NextResponse.json({
      published: true,
      url: site.url,
      slug: site.slug,
      status: site.status,
      publishedAt: site.publishedAt,
      isStale,
    });
  } catch (error) {
    console.error("Publish GET error:", error);
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}

/* ─── DELETE: Unpublish ────────────────────────────────────────────────────── */

export async function DELETE(
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

    const site = await db.query.publishedSites.findFirst({
      where: eq(publishedSites.projectId, projectId),
    });

    if (!site) {
      return NextResponse.json({ error: "Not published" }, { status: 404 });
    }

    // Delete the Vercel project (best-effort — removes all deployments + domain)
    const token = process.env.VERCEL_PUBLISH_TOKEN;
    const teamId = process.env.VERCEL_TEAM_ID;
    const teamQuery = teamId ? `?teamId=${teamId}` : "";

    if (token && site.vercelProjectId) {
      try {
        await fetch(
          `https://api.vercel.com/v9/projects/${site.vercelProjectId}${teamQuery}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          },
        );
      } catch (err) {
        console.error("Failed to delete Vercel project:", err);
        // Continue with DB cleanup even if Vercel delete fails
      }
    }

    // Remove from DB
    await db
      .delete(publishedSites)
      .where(eq(publishedSites.id, site.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Unpublish error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
