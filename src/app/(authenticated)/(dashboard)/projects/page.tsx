import type { Metadata } from "next";
import { ProjectsContent } from "./projects-content";

export const metadata: Metadata = {
  title: "Projects | Calypso",
};

export default function ProjectsPage() {
  return <ProjectsContent />;
}
