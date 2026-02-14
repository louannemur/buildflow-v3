"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FolderUp, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEditorStore } from "@/lib/editor/store";
import { toast } from "sonner";
import { UpgradeModal } from "@/components/features/upgrade-modal";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Upgrade to Project Modal                                                 */
/* ═══════════════════════════════════════════════════════════════════════════ */

interface UpgradeToProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  designName: string;
}

export function UpgradeToProjectModal({
  open,
  onOpenChange,
  designName,
}: UpgradeToProjectModalProps) {
  const router = useRouter();
  const designId = useEditorStore((s) => s.designId);

  const [name, setName] = useState(designName);
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState("");

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setCreating(true);
    try {
      const res = await fetch(`/api/designs/${designId}/upgrade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          description: description.trim() || undefined,
        }),
      });

      if (res.status === 403) {
        const data = await res.json();
        onOpenChange(false);
        setUpgradeMessage(
          data.message ??
            "Projects require Studio or higher. Upgrade to get started.",
        );
        setUpgradeOpen(true);
        return;
      }

      if (!res.ok) {
        toast.error("Failed to create project. Please try again.");
        return;
      }

      const { projectId, projectName } = await res.json();
      toast.success(`Created project "${projectName}"`);
      router.push(`/project/${projectId}`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex size-10 items-center justify-center rounded-full bg-primary/10">
              <FolderUp className="size-5 text-primary" />
            </div>
            <DialogTitle>Turn this design into a full project</DialogTitle>
            <DialogDescription>
              This will create a project with a &quot;Home&quot; page and link
              this design to it. You&apos;ll get access to features, user flows,
              pages, and more.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="project-name" className="text-xs">
                Project Name
              </Label>
              <Input
                id="project-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-desc" className="text-xs">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <textarea
                id="project-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of your project..."
                rows={3}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={creating}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating || !name.trim()}
            >
              {creating && <Loader2 className="mr-1.5 size-3.5 animate-spin" />}
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradeModal
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        feature={upgradeMessage}
      />
    </>
  );
}
