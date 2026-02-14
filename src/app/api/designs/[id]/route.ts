import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { designs, designVersions } from "@/lib/db/schema";
import { updateDesignSchema } from "@/lib/validators/design";

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
    const parsed = updateDesignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    // If toggling isStyleGuide on, clear it from other project designs first
    if (parsed.data.isStyleGuide === true) {
      const design = await db.query.designs.findFirst({
        where: and(eq(designs.id, id), eq(designs.userId, session.user.id)),
        columns: { projectId: true },
      });

      if (design?.projectId) {
        await db
          .update(designs)
          .set({ isStyleGuide: false })
          .where(
            and(
              eq(designs.projectId, design.projectId),
              eq(designs.userId, session.user.id),
            ),
          );
      }
    }

    const [updated] = await db
      .update(designs)
      .set(parsed.data)
      .where(
        and(eq(designs.id, id), eq(designs.userId, session.user.id)),
      )
      .returning({
        id: designs.id,
        name: designs.name,
        isStyleGuide: designs.isStyleGuide,
      });

    if (!updated) {
      return NextResponse.json(
        { error: "Design not found" },
        { status: 404 },
      );
    }

    // If saving HTML, also create a version snapshot
    if (parsed.data.html !== undefined) {
      await db.insert(designVersions).values({
        designId: id,
        html: parsed.data.html,
        prompt: "Manual save",
      });
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
      .delete(designs)
      .where(
        and(eq(designs.id, id), eq(designs.userId, session.user.id)),
      )
      .returning({ id: designs.id });

    if (!deleted) {
      return NextResponse.json(
        { error: "Design not found" },
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
