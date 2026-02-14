import { NextResponse } from "next/server";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects, designs } from "@/lib/db/schema";

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
      currentStep: string;
      updatedAt: Date;
    };

    type DesignItem = {
      type: "design";
      id: string;
      name: string;
      thumbnail: string | null;
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

      items.push(
        ...recentProjects.map(
          (p): ProjectItem => ({ type: "project", ...p }),
        ),
      );
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
          updatedAt: true,
        },
      });

      items.push(
        ...recentDesigns.map(
          (d): DesignItem => ({ type: "design", ...d }),
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
