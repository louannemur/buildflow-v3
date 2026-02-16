import { NextResponse } from "next/server";
import { eq, and, desc, asc, isNotNull } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, designs, pages } from "@/lib/db/schema";

// Cap preview HTML to avoid sending megabytes over the wire.
// 50 KB is enough for the scaled iframe thumbnail to look right.
const MAX_PREVIEW_BYTES = 50_000;

function truncateHtml(html: string): string {
  if (html.length <= MAX_PREVIEW_BYTES) return html;
  return html.slice(0, MAX_PREVIEW_BYTES);
}

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get("tab") ?? "all";
    const limit = Math.min(Number(searchParams.get("limit") ?? 10), 20);

    type ProjectItem = {
      type: "project";
      id: string;
      name: string;
      description: string | null;
      thumbnail: string | null;
      previewHtml: string | null;
      currentStep: string;
      updatedAt: Date;
    };

    type DesignItem = {
      type: "design";
      id: string;
      name: string;
      thumbnail: string | null;
      previewHtml: string | null;
      updatedAt: Date;
    };

    type RecentItem = ProjectItem | DesignItem;

    let items: RecentItem[] = [];

    if (tab === "all" || tab === "projects") {
      const recentProjects = await db.query.projects.findMany({
        where: eq(projects.userId, userId),
        orderBy: [desc(projects.updatedAt)],
        limit,
        columns: {
          id: true,
          name: true,
          description: true,
          thumbnail: true,
          currentStep: true,
          updatedAt: true,
        },
      });

      // Batch: for each project, find its first page's design for preview
      const projectItems: ProjectItem[] = await Promise.all(
        recentProjects.map(async (p) => {
          // If the project already has a thumbnail, skip HTML fetch
          if (p.thumbnail) {
            return { type: "project" as const, ...p, previewHtml: null };
          }

          // Find the first page (by order) that has a design
          const firstPage = await db.query.pages.findFirst({
            where: eq(pages.projectId, p.id),
            orderBy: [asc(pages.order)],
            columns: { id: true },
          });

          if (!firstPage) {
            return { type: "project" as const, ...p, previewHtml: null };
          }

          const pageDesign = await db.query.designs.findFirst({
            where: and(
              eq(designs.projectId, p.id),
              eq(designs.pageId, firstPage.id),
            ),
            columns: { html: true },
          });

          const html = pageDesign?.html && pageDesign.html.length > 0
            ? truncateHtml(pageDesign.html)
            : null;

          // If no design on first page, try any design for this project
          if (!html) {
            const anyDesign = await db.query.designs.findFirst({
              where: and(
                eq(designs.projectId, p.id),
                isNotNull(designs.pageId),
              ),
              columns: { html: true },
            });

            return {
              type: "project" as const,
              ...p,
              previewHtml: anyDesign?.html && anyDesign.html.length > 0
                ? truncateHtml(anyDesign.html)
                : null,
            };
          }

          return { type: "project" as const, ...p, previewHtml: html };
        }),
      );

      items.push(...projectItems);
    }

    if (tab === "all" || tab === "designs") {
      const recentDesigns = await db.query.designs.findMany({
        where: and(
          eq(designs.userId, userId),
          eq(designs.isStandalone, true),
        ),
        orderBy: [desc(designs.updatedAt)],
        limit,
        columns: {
          id: true,
          name: true,
          thumbnail: true,
          html: true,
          updatedAt: true,
        },
      });

      items.push(
        ...recentDesigns.map(
          (d): DesignItem => ({
            type: "design",
            id: d.id,
            name: d.name,
            thumbnail: d.thumbnail,
            previewHtml:
              d.thumbnail ? null :  // Skip HTML if thumbnail exists
              d.html && d.html.length > 0 ? truncateHtml(d.html) : null,
            updatedAt: d.updatedAt,
          }),
        ),
      );
    }

    // Sort merged results by updatedAt desc and slice to limit
    items.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
    items = items.slice(0, limit);

    return NextResponse.json({ items }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
