"use client";

import { useEffect } from "react";

/**
 * Warns the user before leaving the page when there are unsaved changes.
 * Attaches a `beforeunload` listener that triggers the browser's native
 * "Leave site?" confirmation dialog.
 *
 * @param isDirty - whether there are unsaved changes
 */
export function useUnsavedChanges(isDirty: boolean) {
  useEffect(() => {
    if (!isDirty) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);
}
