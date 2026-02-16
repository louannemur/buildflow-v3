import { NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, publishedSites } from "@/lib/db/schema";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: projectId } = await params;

    // Verify project ownership
    const project = await db.query.projects.findFirst({
      where: and(
        eq(projects.id, projectId),
        eq(projects.userId, session.user.id),
      ),
      columns: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug")?.toLowerCase().trim();

    if (!slug || !SLUG_RE.test(slug)) {
      return NextResponse.json(
        { available: false, reason: "Invalid format. Use 3-48 lowercase letters, numbers, and hyphens." },
        { status: 200 },
      );
    }

    // Check if slug is taken by another project
    const taken = await db.query.publishedSites.findFirst({
      where: and(
        eq(publishedSites.slug, slug),
        ne(publishedSites.projectId, projectId),
      ),
      columns: { id: true },
    });

    return NextResponse.json({ available: !taken });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong." },
      { status: 500 },
    );
  }
}
