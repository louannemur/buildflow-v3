"use client";

import { Monitor, Sun, Moon, Globe, Eye, Type, Zap, Bell } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePreferences } from "@/components/providers/preferences-provider";

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Settings Content                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function SettingsContent() {
  const { preferences, isLoading, updatePreference } = usePreferences();

  // ─── Loading skeleton ───────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Preferences</h2>
        <p className="text-sm text-muted-foreground">
          Manage your app appearance and accessibility settings.
        </p>
      </div>

      {/* ═══ Appearance ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Sun className="size-4 text-amber-500" />
            <CardTitle className="text-sm">Appearance</CardTitle>
          </div>
          <CardDescription>
            Choose how Calypso looks to you.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={preferences.theme}
            onValueChange={(value) =>
              updatePreference("theme", value as "system" | "light" | "dark")
            }
            className="grid grid-cols-3 gap-3"
          >
            <ThemeOption value="system" icon={Monitor} label="System" />
            <ThemeOption value="light" icon={Sun} label="Light" />
            <ThemeOption value="dark" icon={Moon} label="Dark" />
          </RadioGroup>
        </CardContent>
      </Card>

      {/* ═══ Language ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Globe className="size-4 text-blue-500" />
            <CardTitle className="text-sm">Language</CardTitle>
          </div>
          <CardDescription>
            Select your preferred language for the interface.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Select value="en" onValueChange={() => {}}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es" disabled>
                  Espa&ntilde;ol (Coming soon)
                </SelectItem>
                <SelectItem value="fr" disabled>
                  Fran&ccedil;ais (Coming soon)
                </SelectItem>
                <SelectItem value="de" disabled>
                  Deutsch (Coming soon)
                </SelectItem>
                <SelectItem value="ja" disabled>
                  日本語 (Coming soon)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Accessibility ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Eye className="size-4 text-violet-500" />
            <CardTitle className="text-sm">Accessibility</CardTitle>
          </div>
          <CardDescription>
            Adjust the app to make it more comfortable for you.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <SettingRow
            icon={Eye}
            label="High contrast"
            description="Increase contrast ratios for better visibility"
            checked={preferences.highContrast}
            onCheckedChange={(v) => updatePreference("highContrast", v)}
          />
          <SettingRow
            icon={Type}
            label="Large text"
            description="Increase base font size from 16px to 18px"
            checked={preferences.largeText}
            onCheckedChange={(v) => updatePreference("largeText", v)}
          />
          <SettingRow
            icon={Zap}
            label="Reduce animations"
            description="Minimize motion and transitions throughout the app"
            checked={preferences.reduceAnimations}
            onCheckedChange={(v) => updatePreference("reduceAnimations", v)}
          />
        </CardContent>
      </Card>

      {/* ═══ Notifications ═══ */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2.5">
            <Bell className="size-4 text-emerald-500" />
            <CardTitle className="text-sm">Notifications</CardTitle>
          </div>
          <CardDescription>
            Manage how you receive updates and alerts.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-medium">
                    Email notifications
                  </Label>
                  <Badge variant="secondary" className="text-[10px]">
                    Coming soon
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Receive updates about your projects and account
                </p>
              </div>
            </div>
            <Switch
              checked={preferences.emailNotifications}
              onCheckedChange={() => {}}
              disabled
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Theme Option ───────────────────────────────────────────────────────── */

function ThemeOption({
  value,
  icon: Icon,
  label,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Label
      htmlFor={`theme-${value}`}
      className="has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent/50 flex cursor-pointer flex-col items-center gap-2 rounded-lg border p-3 transition-colors hover:bg-accent/30"
    >
      <Icon className="size-5 text-muted-foreground" />
      <div className="flex items-center gap-2">
        <RadioGroupItem value={value} id={`theme-${value}`} />
        <span className="text-sm font-medium">{label}</span>
      </div>
    </Label>
  );
}

/* ─── Setting Row ────────────────────────────────────────────────────────── */

function SettingRow({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 text-muted-foreground" />
        <div className="space-y-0.5">
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
