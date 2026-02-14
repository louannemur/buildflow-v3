"use client";

import { useRef, useCallback, useEffect, lazy, Suspense } from "react";
import type { OnMount } from "@monaco-editor/react";
import { Loader2, Lock } from "lucide-react";
import { useEditorStore } from "@/lib/editor/store";
import { useCurrentUser } from "@/hooks/useAuth";

/* ─── Lazy-loaded Monaco editor ──────────────────────────────────────────── */

const MonacoEditor = lazy(() =>
  import("@monaco-editor/react").then((mod) => ({ default: mod.default })),
);

/* ─── Types for Monaco refs ──────────────────────────────────────────────── */

type MonacoEditorInstance = Parameters<OnMount>[0];

/* ─── Debounce helper ────────────────────────────────────────────────────── */

function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number,
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return useCallback(
    (...args: unknown[]) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => callbackRef.current(...args), delay);
    },
    [delay],
  ) as T;
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/*  Code Panel                                                               */
/* ═══════════════════════════════════════════════════════════════════════════ */

export function CodePanel() {
  const source = useEditorStore((s) => s.source);
  const updateSource = useEditorStore((s) => s.updateSource);
  const selectedBfId = useEditorStore((s) => s.selectedBfId);
  const { user } = useCurrentUser();

  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const decorationsRef = useRef<string[]>([]);

  const plan = user?.plan ?? "free";
  const isReadOnly = plan === "free" || plan === "studio";

  // ─── Debounced source update ──────────────────────────────────────

  const debouncedUpdate = useDebouncedCallback((value: unknown) => {
    if (typeof value === "string") {
      updateSource(value);
    }
  }, 500);

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        debouncedUpdate(value);
      }
    },
    [debouncedUpdate],
  );

  // ─── Editor mount ─────────────────────────────────────────────────

  const handleEditorMount: OnMount = useCallback(
    (editor) => {
      editorRef.current = editor;
    },
    [],
  );

  // ─── Scroll to selected element's code ────────────────────────────

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !selectedBfId) {
      // Clear decorations
      if (editor && decorationsRef.current.length > 0) {
        decorationsRef.current = editor.deltaDecorations(
          decorationsRef.current,
          [],
        );
      }
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    // Find the line containing data-bf-id="<selectedBfId>"
    const searchStr = `data-bf-id="${selectedBfId}"`;
    const lineCount = model.getLineCount();
    let targetLine = -1;

    for (let i = 1; i <= lineCount; i++) {
      if (model.getLineContent(i).includes(searchStr)) {
        targetLine = i;
        break;
      }
    }

    if (targetLine === -1) {
      decorationsRef.current = editor.deltaDecorations(
        decorationsRef.current,
        [],
      );
      return;
    }

    // Scroll to and highlight the line
    editor.revealLineInCenter(targetLine);
    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      [
        {
          range: {
            startLineNumber: targetLine,
            startColumn: 1,
            endLineNumber: targetLine,
            endColumn: 1,
          },
          options: {
            isWholeLine: true,
            className: "bf-highlighted-line",
            glyphMarginClassName: "bf-glyph-margin",
          },
        },
      ],
    );
  }, [selectedBfId, source]);

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">
      {/* Read-only banner */}
      {isReadOnly && (
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/50 px-4 py-2">
          <Lock className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Upgrade to Pro to edit code directly
          </span>
        </div>
      )}

      {/* Monaco editor */}
      <div className="min-h-0 flex-1">
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-[#1e1e1e]">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <MonacoEditor
            height="100%"
            language="typescriptreact"
            theme="vs-dark"
            value={source}
            onChange={handleChange}
            onMount={handleEditorMount}
            options={{
              readOnly: isReadOnly,
              minimap: { enabled: false },
              fontSize: 13,
              lineHeight: 20,
              padding: { top: 16 },
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              bracketPairColorization: { enabled: true },
              lineNumbers: "on",
              renderLineHighlight: "all",
              domReadOnly: isReadOnly,
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
