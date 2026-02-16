import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { buildOutputs, publishedSites } from "@/lib/db/schema";

/**
 * Public endpoint — authenticated via preview token (not user session).
 * Called by the banner script injected into preview deployments.
 *
 * Returns publish status so the banner can show the right message:
 * - not published  → "Preview · Not published" + Publish CTA
 * - published & current → "Published" + View site link
 * - published & stale  → "Update available" + Update CTA
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // CORS headers for cross-origin requests from preview deployments
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  try {
    const { id: projectId } = await params;
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Missing token" },
        { status: 401, headers },
      );
    }

    // Validate the preview token matches the latest build
    const output = await db.query.buildOutputs.findFirst({
      where: and(
        eq(buildOutputs.projectId, projectId),
        eq(buildOutputs.status, "complete"),
      ),
      orderBy: [desc(buildOutputs.createdAt)],
      columns: { id: true, previewToken: true },
    });

    if (!output || output.previewToken !== token) {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 403, headers },
      );
    }

    // Check publish status
    const site = await db.query.publishedSites.findFirst({
      where: eq(publishedSites.projectId, projectId),
    });

    if (!site || site.status === "deleted") {
      return NextResponse.json({ published: false }, { headers });
    }

    const isStale = site.buildOutputId !== output.id;

    return NextResponse.json(
      {
        published: true,
        isStale,
        url: site.url,
      },
      { headers },
    );
  } catch {
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500, headers },
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
