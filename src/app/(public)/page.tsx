import type { Metadata } from "next";
import { LandingContent } from "./landing-content";

export const metadata: Metadata = {
  title: "BuildFlow — From Idea to Production-Ready App with AI",
  description:
    "Go from a rough idea to a fully built, production-ready web app. BuildFlow uses AI to generate features, user flows, pages, designs, and clean code — all in one seamless workflow.",
};

export default function LandingPage() {
  return <LandingContent />;
}
