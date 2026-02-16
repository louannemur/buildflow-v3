"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PreviewPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;

    async function createPreview() {
      try {
        const res = await fetch(`/api/projects/${projectId}/preview`, {
          method: "POST",
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error ?? "Failed to create preview.");
          return;
        }

        const data = await res.json();
        if (data.url && data.token) {
          // Redirect with access token — gate script will validate and save to localStorage
          const url = new URL(data.url);
          url.searchParams.set("__pv_token", data.token);
          window.location.replace(url.toString());
        } else if (data.url) {
          window.location.replace(data.url);
        } else {
          setError("Preview URL not available.");
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    }

    createPreview();
  }, [projectId]);

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.close()}
        >
          Close
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
      <Loader2 className="size-8 animate-spin text-primary" />
      <div className="text-center">
        <p className="text-sm font-medium">Deploying preview...</p>
        <p className="mt-1 text-xs text-muted-foreground">
          This may take up to a minute
        </p>
      </div>
    </div>
  );
}
