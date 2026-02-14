import type { Metadata } from "next";
import { ProjectOverview } from "./project-overview";

export const metadata: Metadata = {
  title: "Project | BuildFlow",
};

export default function ProjectWorkspacePage() {
  return <ProjectOverview />;
}
