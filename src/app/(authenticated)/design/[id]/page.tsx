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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return { title: "Design | Calypso" };

  const design = await db.query.designs.findFirst({
    where: and(eq(designs.id, id), eq(designs.userId, session.user.id)),
    columns: { name: true },
  });

  return {
    title: design ? `${design.name} | Calypso` : "Design | Calypso",
  };
}

export default async function DesignStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) notFound();

  const design = await db.query.designs.findFirst({
    where: and(eq(designs.id, id), eq(designs.userId, session.user.id)),
  });

  if (!design) notFound();

  // If part of a project, find the style guide and project context
  let styleGuideCode: string | null = null;
  let projectContext: ProjectContext | null = null;

  if (design.projectId) {
    // Fetch style guide
    const sg = await db.query.designs.findFirst({
      where: and(
        eq(designs.projectId, design.projectId),
        eq(designs.isStyleGuide, true),
        eq(designs.userId, session.user.id),
      ),
      columns: { html: true },
    });

    if (sg?.html) {
      styleGuideCode = sg.html;
    }

    // Fetch project context for @mentions
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, design.projectId),
      columns: { name: true, description: true },
    });

    if (project) {
      const [projectFeatures, projectFlows, projectPages] = await Promise.all([
        db.query.features.findMany({
          where: eq(features.projectId, design.projectId!),
          columns: { title: true, description: true },
          orderBy: [asc(features.order)],
        }),
        db.query.userFlows.findMany({
          where: eq(userFlows.projectId, design.projectId!),
          columns: { title: true, steps: true },
          orderBy: [asc(userFlows.order)],
        }),
        db.query.pages.findMany({
          where: eq(pages.projectId, design.projectId!),
          columns: { title: true, description: true },
          orderBy: [asc(pages.order)],
        }),
      ]);

      projectContext = {
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
    }
  }

  return (
    <div className="h-screen">
      <DesignEditor
        designId={design.id}
        projectId={design.projectId}
        pageId={design.pageId}
        designName={design.name}
        isStyleGuide={design.isStyleGuide}
        initialCode={design.html}
        styleGuideCode={styleGuideCode}
        projectContext={projectContext}
      />
    </div>
  );
}
