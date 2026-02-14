import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userFlows, projects } from "@/lib/db/schema";
import { updateFlowSchema } from "@/lib/validators/flow";

async function verifyProjectOwnership(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    columns: { id: true },
  });
  return project;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; flowId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, flowId } = await params;
    const project = await verifyProjectOwnership(id, session.user.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const parsed = updateFlowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(userFlows)
      .set(parsed.data)
      .where(
        and(eq(userFlows.id, flowId), eq(userFlows.projectId, id)),
      )
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: "Flow not found" },
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
  { params }: { params: Promise<{ id: string; flowId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, flowId } = await params;
    const project = await verifyProjectOwnership(id, session.user.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    const [deleted] = await db
      .delete(userFlows)
      .where(
        and(eq(userFlows.id, flowId), eq(userFlows.projectId, id)),
      )
      .returning({ id: userFlows.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Flow not found" },
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
