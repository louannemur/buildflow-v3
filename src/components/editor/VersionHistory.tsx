"use client";

import { useEffect, useState, useCallback } from "react";
import { History, RotateCcw, Loader2, X } from "lucide-react";
import { useEditorStore } from "@/lib/editor/store";
import { cn } from "@/lib/utils";

interface Version {
  id: string;
  prompt: string | null;
  createdAt: string;
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getVersionLabel(prompt: string | null): string {
  if (!prompt) return "Design update";
  if (prompt === "Manual save") return "Manual save";
  if (prompt === "Before restore") return "Before restore";
  if (prompt.length > 50) return prompt.slice(0, 50) + "...";
  return prompt;
}

interface VersionHistoryProps {
  onRestore: (html: string) => void;
}

export function VersionHistory({ onRestore }: VersionHistoryProps) {
  const designId = useEditorStore((s) => s.designId);
  const toggleHistory = useEditorStore((s) => s.toggleHistory);
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    if (!designId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/designs/${designId}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.items ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [designId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  async function handleRestore(versionId: string) {
    if (restoringId) return;
    setRestoringId(versionId);

    try {
      const res = await fetch(`/api/designs/${designId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
      });

      if (res.ok) {
        const data = await res.json();
        onRestore(data.html);
        // Refresh the list to show the "Before restore" entry
        fetchVersions();
      }
    } catch {
      // Silently fail
    } finally {
      setRestoringId(null);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <History className="size-3 text-muted-foreground" />
          <h3 className="text-xs font-semibold">Version History</h3>
        </div>
        <button
          onClick={toggleHistory}
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <History className="mb-2 size-5 text-muted-foreground/40" />
            <p className="text-xs text-muted-foreground">No versions yet</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground/60">
              Versions are saved when you generate or edit designs
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {versions.map((version, index) => (
              <div
                key={version.id}
                className={cn(
                  "group flex items-center justify-between rounded-lg px-2.5 py-2 transition-colors hover:bg-muted/60",
                  index === 0 && "bg-muted/30",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {index === 0 ? "Current version" : getVersionLabel(version.prompt)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDate(version.createdAt)}
                  </p>
                </div>
                {index > 0 && (
                  <button
                    onClick={() => handleRestore(version.id)}
                    disabled={!!restoringId}
                    className="ml-2 flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground opacity-0 transition-all hover:bg-background hover:text-foreground group-hover:opacity-100"
                  >
                    {restoringId === version.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3" />
                    )}
                    Restore
                  </button>
                )}
                {index === 0 && (
                  <span className="ml-2 shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Latest
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
