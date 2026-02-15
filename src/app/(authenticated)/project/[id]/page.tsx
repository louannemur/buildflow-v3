import type { Metadata } from "next";
import { ProjectOverview } from "./project-overview";

export const metadata: Metadata = {
  title: "Project | Calypso",
};

export default function ProjectWorkspacePage() {
  return <ProjectOverview />;
}
