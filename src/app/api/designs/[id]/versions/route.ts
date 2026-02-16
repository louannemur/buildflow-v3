import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { designs, designVersions } from "@/lib/db/schema";

/** GET — list all versions for a design (most recent first) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Verify ownership
    const design = await db.query.designs.findFirst({
      where: and(eq(designs.id, id), eq(designs.userId, session.user.id)),
      columns: { id: true },
    });

    if (!design) {
      return NextResponse.json(
        { error: "Design not found" },
        { status: 404 },
      );
    }

    const versions = await db.query.designVersions.findMany({
      where: eq(designVersions.designId, id),
      orderBy: [desc(designVersions.createdAt)],
      columns: {
        id: true,
        prompt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      items: versions.map((v) => ({
        id: v.id,
        prompt: v.prompt,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}

/** POST — restore a specific version (sets it as the current design HTML) */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const versionId = body.versionId;

    if (!versionId || typeof versionId !== "string") {
      return NextResponse.json(
        { error: "versionId is required" },
        { status: 400 },
      );
    }

    // Verify ownership
    const design = await db.query.designs.findFirst({
      where: and(eq(designs.id, id), eq(designs.userId, session.user.id)),
      columns: { id: true, html: true },
    });

    if (!design) {
      return NextResponse.json(
        { error: "Design not found" },
        { status: 404 },
      );
    }

    // Find the version
    const version = await db.query.designVersions.findFirst({
      where: and(
        eq(designVersions.id, versionId),
        eq(designVersions.designId, id),
      ),
    });

    if (!version) {
      return NextResponse.json(
        { error: "Version not found" },
        { status: 404 },
      );
    }

    // Save current state as a version before restoring (so user can undo)
    if (design.html && design.html.length > 0) {
      await db.insert(designVersions).values({
        designId: id,
        html: design.html,
        prompt: "Before restore",
      });
    }

    // Restore the version
    await db
      .update(designs)
      .set({ html: version.html })
      .where(eq(designs.id, id));

    return NextResponse.json({ html: version.html });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
