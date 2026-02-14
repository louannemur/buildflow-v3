import { NextResponse } from "next/server";
import { eq, and, asc, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { pages, projects } from "@/lib/db/schema";
import { createPageSchema } from "@/lib/validators/page";

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

    const items = await db.query.pages.findMany({
      where: eq(pages.projectId, id),
      orderBy: [asc(pages.order)],
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
    const parsed = createPageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const [{ value: maxOrder }] = await db
      .select({ value: count() })
      .from(pages)
      .where(eq(pages.projectId, id));

    const [page] = await db
      .insert(pages)
      .values({
        projectId: id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        contents: [],
        order: maxOrder,
      })
      .returning();

    return NextResponse.json(page, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
