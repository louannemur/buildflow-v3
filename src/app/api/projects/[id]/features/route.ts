import { NextResponse } from "next/server";
import { eq, and, asc, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { features, projects } from "@/lib/db/schema";
import { createFeatureSchema } from "@/lib/validators/feature";

async function verifyProjectOwnership(projectId: string, userId: string) {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
    columns: { id: true, name: true, description: true },
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

    const items = await db.query.features.findMany({
      where: eq(features.projectId, id),
      orderBy: [asc(features.order)],
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
    const parsed = createFeatureSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    // Get next order value
    const [{ value: maxOrder }] = await db
      .select({ value: count() })
      .from(features)
      .where(eq(features.projectId, id));

    const [feature] = await db
      .insert(features)
      .values({
        projectId: id,
        title: parsed.data.title,
        description: parsed.data.description,
        order: maxOrder,
      })
      .returning();

    return NextResponse.json(feature, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
