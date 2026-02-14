"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import { MotionConfig } from "framer-motion";
import { toast } from "sonner";
import type { UserPreferences } from "@/lib/db/schema";
import { DEFAULT_PREFERENCES } from "@/lib/db/schema";

/* ─── Context ────────────────────────────────────────────────────────────── */

interface PreferencesContextValue {
  preferences: UserPreferences;
  isLoading: boolean;
  updatePreference: <K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) => Promise<void>;
}

export const PreferencesContext = createContext<PreferencesContextValue | null>(
  null,
);

/* ─── Provider ───────────────────────────────────────────────────────────── */

export function PreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();
  const { setTheme } = useTheme();
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);
  const hasFetched = useRef(false);

  // ─── Fetch on mount ────────────────────────────────────────────────

  useEffect(() => {
    if (status !== "authenticated" || hasFetched.current) return;
    hasFetched.current = true;

    async function load() {
      try {
        const res = await fetch("/api/users/me/preferences");
        if (!res.ok) return;
        const data = await res.json();
        setPreferences(data.preferences);
      } catch {
        // Silently fall back to defaults
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [status]);

  // Mark loading done for unauthenticated users
  useEffect(() => {
    if (status === "unauthenticated") {
      setIsLoading(false);
    }
  }, [status]);

  // ─── Apply DOM side effects ────────────────────────────────────────

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("high-contrast", preferences.highContrast);
    root.classList.toggle("large-text", preferences.largeText);
    root.classList.toggle("reduce-motion", preferences.reduceAnimations);
  }, [preferences.highContrast, preferences.largeText, preferences.reduceAnimations]);

  // Sync theme with next-themes
  useEffect(() => {
    if (!isLoading) {
      setTheme(preferences.theme);
    }
  }, [preferences.theme, isLoading, setTheme]);

  // ─── Update preference ─────────────────────────────────────────────

  const updatePreference = useCallback(
    async <K extends keyof UserPreferences>(
      key: K,
      value: UserPreferences[K],
    ) => {
      const previous = preferences;
      // Optimistic update
      setPreferences((prev) => ({ ...prev, [key]: value }));

      try {
        const res = await fetch("/api/users/me/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [key]: value }),
        });

        if (!res.ok) {
          // Rollback
          setPreferences(previous);
          toast.error("Failed to save preference");
          return;
        }

        const data = await res.json();
        setPreferences(data.preferences);
      } catch {
        setPreferences(previous);
        toast.error("Failed to save preference");
      }
    },
    [preferences],
  );

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <PreferencesContext.Provider
      value={{ preferences, isLoading, updatePreference }}
    >
      <MotionConfig
        reducedMotion={preferences.reduceAnimations ? "always" : "never"}
      >
        {children}
      </MotionConfig>
    </PreferencesContext.Provider>
  );
}

/* ─── Hook ────────────────────────────────────────────────────────────────── */

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
