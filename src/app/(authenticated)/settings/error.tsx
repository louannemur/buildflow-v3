"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Settings error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h2 className="text-lg font-semibold">Settings error</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        {error.message || "An unknown error occurred"}
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">
          Digest: {error.digest}
        </p>
      )}
      <Button onClick={reset} variant="outline" size="sm">
        Try again
      </Button>
    </div>
  );
}
