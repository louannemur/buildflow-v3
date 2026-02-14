import { notFound } from "next/navigation";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { designs, features, userFlows, pages, projects } from "@/lib/db/schema";
import { DesignEditor } from "@/components/editor/DesignEditor";
import type { ProjectContext } from "@/components/editor/DesignEditor";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}) {
  const { id, pageId } = await params;
  const session = await auth();
  if (!session?.user) return { title: "Design | BuildFlow" };

  const [project, page] = await Promise.all([
    db.query.projects.findFirst({
      where: and(eq(projects.id, id), eq(projects.userId, session.user.id)),
      columns: { name: true },
    }),
    db.query.pages.findFirst({
      where: and(eq(pages.id, pageId), eq(pages.projectId, id)),
      columns: { title: true },
    }),
  ]);

  const title = page?.title
    ? `${page.title} — ${project?.name ?? "Project"} | BuildFlow`
    : "Design | BuildFlow";

  return { title };
}

export default async function ProjectDesignPage({
  params,
}: {
  params: Promise<{ id: string; pageId: string }>;
}) {
  const { id: projectId, pageId } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const userId = session.user.id;

  // Load project and page in parallel
  const [project, page] = await Promise.all([
    db.query.projects.findFirst({
      where: and(eq(projects.id, projectId), eq(projects.userId, userId)),
      columns: { id: true, name: true, description: true },
    }),
    db.query.pages.findFirst({
      where: and(eq(pages.id, pageId), eq(pages.projectId, projectId)),
    }),
  ]);

  if (!project || !page) notFound();

  // Find the design for this page, or create one
  let design = await db.query.designs.findFirst({
    where: and(
      eq(designs.pageId, pageId),
      eq(designs.projectId, projectId),
      eq(designs.userId, userId),
    ),
  });

  if (!design) {
    const [created] = await db
      .insert(designs)
      .values({
        userId,
        projectId,
        pageId,
        name: page.title,
        html: "",
        isStandalone: false,
      })
      .returning();

    design = created;
  }

  // Fetch the project's style guide design (if one exists)
  let styleGuideCode: string | null = null;
  const sg = await db.query.designs.findFirst({
    where: and(
      eq(designs.projectId, projectId),
      eq(designs.isStyleGuide, true),
      eq(designs.userId, userId),
    ),
    columns: { html: true },
  });

  if (sg?.html) {
    styleGuideCode = sg.html;
  }

  // Fetch project context for @mentions
  const [projectFeatures, projectFlows, projectPages] = await Promise.all([
    db.query.features.findMany({
      where: eq(features.projectId, projectId),
      columns: { title: true, description: true },
      orderBy: [asc(features.order)],
    }),
    db.query.userFlows.findMany({
      where: eq(userFlows.projectId, projectId),
      columns: { title: true, steps: true },
      orderBy: [asc(userFlows.order)],
    }),
    db.query.pages.findMany({
      where: eq(pages.projectId, projectId),
      columns: { title: true, description: true },
      orderBy: [asc(pages.order)],
    }),
  ]);

  const projectContext: ProjectContext = {
    name: project.name,
    description: project.description,
    features: projectFeatures,
    flows: projectFlows.map((f) => ({
      title: f.title,
      steps: (f.steps ?? []).map((s) => ({
        title: s.title,
        description: s.description,
      })),
    })),
    pages: projectPages,
  };

  return (
    <div className="h-[calc(100svh-3.5rem)]">
      <DesignEditor
        designId={design.id}
        projectId={projectId}
        pageId={pageId}
        designName={design.name}
        isStyleGuide={design.isStyleGuide}
        initialCode={design.html}
        styleGuideCode={styleGuideCode}
        projectContext={projectContext}
      />
    </div>
  );
}
