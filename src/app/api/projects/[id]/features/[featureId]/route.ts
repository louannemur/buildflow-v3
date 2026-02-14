import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { features, projects } from "@/lib/db/schema";
import { updateFeatureSchema } from "@/lib/validators/feature";

async function verifyProjectOwnership(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    columns: { id: true },
  });
  return project;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; featureId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, featureId } = await params;
    const project = await verifyProjectOwnership(id, session.user.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const parsed = updateFeatureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(features)
      .set(parsed.data)
      .where(
        and(
          eq(features.id, featureId),
          eq(features.projectId, id),
        ),
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Feature not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(updated, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; featureId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, featureId } = await params;
    const project = await verifyProjectOwnership(id, session.user.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    const [deleted] = await db
      .delete(features)
      .where(
        and(
          eq(features.id, featureId),
          eq(features.projectId, id),
        ),
      )
      .returning({ id: features.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Feature not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
