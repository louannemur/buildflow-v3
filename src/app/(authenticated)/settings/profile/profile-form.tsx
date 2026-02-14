"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Camera,
  Loader2,
  Check,
  Mail,
  BadgeCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface UserProfile {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  emailVerified: string | null;
  createdAt: string;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Profile Form                                                             */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function ProfileForm() {
  const { update: updateSession } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── State ─────────────────────────────────────────────────────────

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSaved, setShowSaved] = useState(false);

  const [name, setName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<string | null>(null); // base64

  // ─── Fetch profile ────────────────────────────────────────────────

  useEffect(() => {
    async function fetchProfile() {
      try {
        const res = await fetch("/api/users/me");
        if (!res.ok) return;

        const data = await res.json();
        setProfile(data.user);
        setName(data.user.name ?? "");
      } catch {
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    fetchProfile();
  }, []);

  // ─── Avatar change ────────────────────────────────────────────────

  function handleAvatarClick() {
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image must be under 2MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setAvatarPreview(base64);
      setAvatarFile(base64);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  // ─── Save ─────────────────────────────────────────────────────────

  const hasChanges =
    name !== (profile?.name ?? "") || avatarFile !== null;

  const handleSave = useCallback(async () => {
    if (saving || !hasChanges) return;
    setSaving(true);

    try {
      const body: Record<string, unknown> = {};

      if (name !== (profile?.name ?? "")) {
        body.name = name.trim();
      }

      if (avatarFile !== null) {
        body.image = avatarFile;
      }

      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to save");
        return;
      }

      const data = await res.json();
      setProfile((prev) => (prev ? { ...prev, ...data.user } : prev));
      setAvatarFile(null);
      setAvatarPreview(null);

      // Update the NextAuth session so the navbar avatar/name refreshes
      await updateSession();

      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }, [saving, hasChanges, name, avatarFile, profile, updateSession]);

  // ─── Loading skeleton ─────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (!profile) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load profile. Please refresh the page.
      </p>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  const displayImage = avatarPreview ?? profile.image;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Profile</h2>
        <p className="text-sm text-muted-foreground">
          Your personal information and public profile.
        </p>
      </div>

      {/* Avatar card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Avatar</CardTitle>
          <CardDescription>
            Your profile picture. Click to upload a new one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={handleAvatarClick}
              className="group relative shrink-0"
            >
              <Avatar className="size-20">
                <AvatarImage
                  src={displayImage ?? undefined}
                  alt={profile.name ?? "Avatar"}
                />
                <AvatarFallback className="text-xl">
                  {getInitials(profile.name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera className="size-5 text-white" />
              </div>
            </button>
            <div className="space-y-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={handleAvatarClick}
              >
                Change Avatar
              </Button>
              <p className="text-[11px] text-muted-foreground">
                JPG, PNG or GIF. Max 2MB.
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Name card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Display Name</CardTitle>
          <CardDescription>
            This is the name shown on your profile and in your projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-sm">
            <Label htmlFor="display-name" className="sr-only">
              Display Name
            </Label>
            <Input
              id="display-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="h-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Email Address</CardTitle>
          <CardDescription>
            Your email is used for sign-in and notifications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex max-w-sm items-center gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={profile.email}
                readOnly
                className="h-9 bg-muted/50 pl-9 text-muted-foreground"
              />
            </div>
            {profile.emailVerified && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <BadgeCheck className="size-3.5" />
                Verified
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3 pt-2">
        <Button onClick={handleSave} disabled={saving || !hasChanges}>
          {saving ? (
            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
          ) : showSaved ? (
            <Check className="mr-1.5 size-3.5" />
          ) : null}
          {showSaved ? "Saved" : "Save Changes"}
        </Button>
        {!hasChanges && !showSaved && (
          <span className="text-xs text-muted-foreground">No changes</span>
        )}
      </div>
    </div>
  );
}
