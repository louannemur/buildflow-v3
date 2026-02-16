import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { designs } from "@/lib/db/schema";
import { reviewAndFixDesign } from "@/lib/ai/design";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;
    const userId = session.user.id;

    const body = await req.json();
    const designId = body.designId;

    if (!designId || typeof designId !== "string") {
      return NextResponse.json(
        { error: "designId is required" },
        { status: 400 },
      );
    }

    // Find the design (must belong to this user + project)
    const design = await db.query.designs.findFirst({
      where: and(
        eq(designs.id, designId),
        eq(designs.projectId, projectId),
        eq(designs.userId, userId),
      ),
      columns: { id: true, html: true },
    });

    if (!design || !design.html || design.html.length === 0) {
      return NextResponse.json(
        { error: "Design not found or has no content" },
        { status: 404 },
      );
    }

    // Run Claude review & fix
    const fixedHtml = await reviewAndFixDesign(design.html);

    // Update in DB
    await db
      .update(designs)
      .set({ html: fixedHtml })
      .where(eq(designs.id, design.id));

    return NextResponse.json({ id: design.id, html: fixedHtml });
  } catch (error) {
    console.error("Design review error:", error);
    return NextResponse.json(
      { error: "Design review failed." },
      { status: 500 },
    );
  }
}
