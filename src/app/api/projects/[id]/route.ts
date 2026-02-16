import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { updateProjectSchema } from "@/lib/validators/project";

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

    const project = await db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, session.user.id)),
      with: {
        features: {
          orderBy: (features, { asc }) => [asc(features.order)],
        },
        userFlows: {
          orderBy: (userFlows, { asc }) => [asc(userFlows.order)],
        },
        pages: {
          orderBy: (pages, { asc }) => [asc(pages.order)],
        },
        designs: {
          columns: {
            id: true,
            name: true,
            thumbnail: true,
            fonts: true,
            colors: true,
            isStandalone: true,
            isStyleGuide: true,
            pageId: true,
            createdAt: true,
            updatedAt: true,
            // html excluded — fetched lazily by the designs page
          },
        },
        buildConfig: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(project, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
    const parsed = updateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const [updated] = await db
      .update(projects)
      .set(parsed.data)
      .where(
        and(eq(projects.id, id), eq(projects.userId, session.user.id)),
      )
      .returning({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        status: projects.status,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Project not found" },
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
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [deleted] = await db
      .update(projects)
      .set({ status: "archived" })
      .where(
        and(eq(projects.id, id), eq(projects.userId, session.user.id)),
      )
      .returning({ id: projects.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Project not found" },
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
