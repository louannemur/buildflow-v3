import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, buildOutputs, buildConfigs } from "@/lib/db/schema";

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
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json(
        { error: "Vercel access token is required" },
        { status: 400 },
      );
    }

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.userId, session.user.id),
      ),
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
      columns: { files: true },
    });

    if (!output?.files || output.files.length === 0) {
      return NextResponse.json(
        { error: "No completed build found. Build your project first." },
        { status: 404 },
      );
    }

    const files = output.files as { path: string; content: string }[];

    // Get build config for framework detection
    const config = await db.query.buildConfigs.findFirst({
      where: eq(buildConfigs.projectId, projectId),
      columns: { framework: true },
    });

    // Upload each file to Vercel
    const fileRefs: { file: string; sha: string; size: number }[] = [];

    for (const file of files) {
      const content = Buffer.from(file.content, "utf-8");
      const sha = createHash("sha1").update(content).digest("hex");

      const uploadRes = await fetch("https://api.vercel.com/v2/files", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/octet-stream",
          "Content-Length": String(content.length),
          "x-vercel-digest": sha,
        },
        body: content,
      });

      // 409 = file already exists (same hash) — that's fine
      if (!uploadRes.ok && uploadRes.status !== 409) {
        const errText = await uploadRes.text();
        console.error("Vercel file upload failed:", uploadRes.status, errText);

        if (uploadRes.status === 401 || uploadRes.status === 403) {
          return NextResponse.json(
            { error: "Invalid Vercel token. Please check your access token." },
            { status: 401 },
          );
        }

        return NextResponse.json(
          { error: "Failed to upload files to Vercel." },
          { status: 500 },
        );
      }

      fileRefs.push({ file: file.path, sha, size: content.length });
    }

    // Map framework to Vercel's framework identifier
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

    const projectSlug = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    // Create deployment
    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: projectSlug,
        files: fileRefs,
        projectSettings: {
          framework,
        },
      }),
    });

    if (!deployRes.ok) {
      const errData = await deployRes.json().catch(() => ({}));
      console.error("Vercel deployment failed:", deployRes.status, errData);

      if (deployRes.status === 401 || deployRes.status === 403) {
        return NextResponse.json(
          { error: "Invalid Vercel token. Please check your access token." },
          { status: 401 },
        );
      }

      return NextResponse.json(
        {
          error:
            errData?.error?.message ||
            "Deployment failed. Please try again.",
        },
        { status: 500 },
      );
    }

    const deployment = await deployRes.json();

    return NextResponse.json({
      url: `https://${deployment.url}`,
      deploymentId: deployment.id,
    });
  } catch (error) {
    console.error("Vercel deploy error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
