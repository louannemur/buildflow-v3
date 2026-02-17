import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import JSZip from "jszip";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, buildOutputs } from "@/lib/db/schema";

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
      columns: { id: true, name: true },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    // Get latest complete build
    let output = await db.query.buildOutputs.findFirst({
      where: and(
        eq(buildOutputs.projectId, projectId),
        eq(buildOutputs.status, "complete"),
      ),
      orderBy: [desc(buildOutputs.createdAt)],
      columns: { id: true, files: true },
    });

    // Recovery: check for "generating" builds with saved files (function timeout)
    if (!output?.files || output.files.length === 0) {
      const pending = await db.query.buildOutputs.findFirst({
        where: and(
          eq(buildOutputs.projectId, projectId),
          eq(buildOutputs.status, "generating"),
        ),
        orderBy: [desc(buildOutputs.createdAt)],
        columns: { id: true, files: true },
      });
      if (pending?.files && pending.files.length > 0) {
        await db.update(buildOutputs).set({ status: "complete" }).where(eq(buildOutputs.id, pending.id));
        output = pending;
      }
    }

    if (!output?.files || output.files.length === 0) {
      return NextResponse.json(
        { error: "No completed build found" },
        { status: 404 },
      );
    }

    // Generate ZIP
    const zip = new JSZip();

    for (const file of output.files) {
      zip.file(file.path, file.content);
    }

    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    const slug = project.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${slug}-project.zip"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
