import { NextResponse } from "next/server";
import { eq, and, asc, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { userFlows, projects } from "@/lib/db/schema";
import { createFlowSchema } from "@/lib/validators/flow";

async function verifyProjectOwnership(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    columns: { id: true },
  });
  return project;
}

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
    const project = await verifyProjectOwnership(id, session.user.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    const items = await db.query.userFlows.findMany({
      where: eq(userFlows.projectId, id),
      orderBy: [asc(userFlows.order)],
    });

    return NextResponse.json({ items }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

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
    const project = await verifyProjectOwnership(id, session.user.id);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    const body = await req.json();
    const parsed = createFlowSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const [{ value: maxOrder }] = await db
      .select({ value: count() })
      .from(userFlows)
      .where(eq(userFlows.projectId, id));

    const [flow] = await db
      .insert(userFlows)
      .values({
        projectId: id,
        title: parsed.data.title,
        steps: parsed.data.steps,
        order: maxOrder,
      })
      .returning();

    return NextResponse.json(flow, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
