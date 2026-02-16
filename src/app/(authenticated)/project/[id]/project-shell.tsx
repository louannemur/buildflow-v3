"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  ProjectLayout,
  type ProjectData,
} from "@/components/layout/ProjectLayout";
import { useProjectStore } from "@/stores/project-store";

export function ProjectShell({
  projectId,
  children,
}: {
  projectId: string;
  children: React.ReactNode;
}) {
  const [error, setError] = useState(false);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const prevId = useRef<string | null>(null);

  useEffect(() => {
    // Same project already loaded — reuse store data
    if (prevId.current === projectId) return;

    const s = useProjectStore.getState();
    if (s.project?.id === projectId && !s.loading) {
      prevId.current = projectId;
      setProjectData({
        id: s.project.id,
        name: s.project.name,
        description: s.project.description,
        currentStep: s.project.currentStep,
        features: s.features.map((f) => ({ id: f.id, title: f.title })),
        userFlows: s.userFlows.map((f) => ({ id: f.id, title: f.title })),
        pages: s.pages.map((p) => ({ id: p.id, title: p.title })),
        designs: s.designs.map((d) => ({ id: d.id, title: d.name })),
      });
      return;
    }

    let cancelled = false;
    prevId.current = projectId;

    async function fetchProject() {
      useProjectStore.getState().setLoading(true);
      try {
        const res = await fetch(`/api/projects/${projectId}`);

        if (!res.ok) {
          if (!cancelled) setError(true);
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        const store = useProjectStore.getState();

        store.setProject({
          id: data.id,
          name: data.name,
          description: data.description,
          thumbnail: data.thumbnail,
          currentStep: data.currentStep,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
        store.setFeatures(data.features ?? []);
        store.setUserFlows(data.userFlows ?? []);
        store.setPages(data.pages ?? []);
        store.setDesigns(data.designs ?? []);
        store.setBuildConfig(data.buildConfig ?? null);

        setProjectData({
          id: data.id,
          name: data.name,
          description: data.description,
          currentStep: data.currentStep,
          features: (data.features ?? []).map(
            (f: { id: string; title: string }) => ({
              id: f.id,
              title: f.title,
            }),
          ),
          userFlows: (data.userFlows ?? []).map(
            (f: { id: string; title: string }) => ({
              id: f.id,
              title: f.title,
            }),
          ),
          pages: (data.pages ?? []).map(
            (p: { id: string; title: string }) => ({
              id: p.id,
              title: p.title,
            }),
          ),
          designs: (data.designs ?? []).map(
            (d: { id: string; name: string }) => ({
              id: d.id,
              title: d.name,
            }),
          ),
        });
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) useProjectStore.getState().setLoading(false);
      }
    }

    fetchProject();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (error) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg font-semibold">Project not found</p>
        <p className="text-sm text-muted-foreground">
          This project doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/projects">Back to Projects</Link>
        </Button>
      </div>
    );
  }

  if (!projectData) {
    return (
      <div className="flex min-h-svh flex-col">
        {/* Skeleton navbar */}
        <div className="h-14 border-b border-border/50 bg-background/80">
          <div className="flex h-full items-center gap-4 px-6">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-40" />
            <div className="ml-auto">
              <Skeleton className="size-8 rounded-full" />
            </div>
          </div>
        </div>
        <div className="flex flex-1">
          {/* Skeleton sidebar */}
          <div className="hidden w-60 border-r border-border/50 p-4 md:block">
            <Skeleton className="mb-4 h-10 w-full" />
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          </div>
          {/* Skeleton content */}
          <div className="flex-1 p-8">
            <Skeleton className="mb-4 h-8 w-64" />
            <Skeleton className="mb-2 h-4 w-96" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
      </div>
    );
  }

  return <ProjectLayout project={projectData}>{children}</ProjectLayout>;
}
