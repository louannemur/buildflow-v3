import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, designs } from "@/lib/db/schema";

/**
 * GET /api/projects/[id]/designs/html
 * Returns only { id, html } for each design in the project.
 * Used by the designs page to lazy-load HTML for previews.
 */
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

    const projectDesigns = await db.query.designs.findMany({
      where: eq(designs.projectId, projectId),
      columns: { id: true, html: true },
    });

    return NextResponse.json(projectDesigns, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
