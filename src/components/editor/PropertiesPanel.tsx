"use client";

import * as React from "react";
import {
  X,
  ChevronDown,
  ChevronRight,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
} from "lucide-react";
import { useEditorStore } from "@/lib/editor/store";
import {
  updateElementClasses,
  addClassToElement,
  removeClassFromElement,
  updateElementText,
  updateElementAttribute,
} from "@/lib/design/code-mutator";
import { injectBfIds, stripBfIds } from "@/lib/design/inject-bf-ids";
import {
  parseTailwindClasses,
  swapClass,
  twClassToHex,
  hexToTwClass,
  extractPaddingValue,
  FONT_WEIGHTS,
  FONT_SIZES,
  SHADOW_OPTIONS,
  type ParsedStyles,
} from "@/lib/design/tailwind-parser";

/* ─── Helpers ────────────────────────────────────────────────────────── */

/** Convert "rgb(r, g, b)" or "rgba(r, g, b, a)" to "#rrggbb" */
function rgbToHex(rgb: string): string | null {
  const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return null;
  const r = parseInt(match[1]).toString(16).padStart(2, "0");
  const g = parseInt(match[2]).toString(16).padStart(2, "0");
  const b = parseInt(match[3]).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

/* ─── Props ──────────────────────────────────────────────────────────── */

interface PropertiesPanelProps {
  designCode: string;
  onCodeChange: (newCode: string) => void;
}

/* ─── Small reusable components ──────────────────────────────────────── */

function PropInput({
  label,
  value,
  onChange,
  placeholder,
  readOnly,
  className,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
}) {
  const [local, setLocal] = React.useState(value);
  React.useEffect(() => setLocal(value), [value]);

  return (
    <div className={className}>
      <label className="mb-0.5 block text-[10px] text-muted-foreground">
        {label}
      </label>
      <input
        type="text"
        className="h-7 w-full rounded border border-border/60 bg-muted/30 px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none disabled:opacity-50"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          if (onChange && local !== value) onChange(local);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onChange) {
            onChange(local);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "Escape") {
            setLocal(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={readOnly}
      />
    </div>
  );
}

function ColorInput({
  label,
  hex,
  onChange,
}: {
  label?: string;
  hex: string | null;
  onChange: (hex: string) => void;
}) {
  const colorRef = React.useRef<HTMLInputElement>(null);
  const displayHex = hex || "";
  const [localHex, setLocalHex] = React.useState(displayHex);
  React.useEffect(() => setLocalHex(hex || ""), [hex]);

  return (
    <div className="flex-1">
      {label && (
        <label className="mb-0.5 block text-[10px] text-muted-foreground">
          {label}
        </label>
      )}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="size-7 shrink-0 rounded border border-border/60"
          style={{ backgroundColor: hex || "transparent" }}
          onClick={() => colorRef.current?.click()}
        />
        <input
          ref={colorRef}
          type="color"
          className="invisible absolute size-0"
          value={hex || "#000000"}
          onChange={(e) => {
            setLocalHex(e.target.value);
            onChange(e.target.value);
          }}
        />
        <input
          type="text"
          className="h-7 w-full min-w-0 rounded border border-border/60 bg-muted/30 px-2 text-xs uppercase text-foreground focus:border-primary/50 focus:outline-none"
          value={localHex.replace("#", "")}
          onChange={(e) => {
            const v = e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
            setLocalHex(`#${v}`);
          }}
          onBlur={() => {
            if (localHex.length >= 4) onChange(localHex);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && localHex.length >= 4) {
              onChange(localHex);
              (e.target as HTMLInputElement).blur();
            }
          }}
          placeholder="hex"
        />
      </div>
    </div>
  );
}

function Section({
  title,
  children,
  defaultOpen = true,
  action,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  action?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <div className="border-b border-border/40">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => setOpen(!open)}
      >
        <span className="flex items-center gap-1">
          {open ? (
            <ChevronDown className="size-3" />
          ) : (
            <ChevronRight className="size-3" />
          )}
          {title}
        </span>
        {action && (
          <span onClick={(e) => e.stopPropagation()}>{action}</span>
        )}
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-0.5 block text-[10px] text-muted-foreground">
        {label}
      </label>
      <select
        className="h-7 w-full appearance-none rounded border border-border/60 bg-muted/30 px-2 text-xs text-foreground focus:border-primary/50 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────────── */

export function PropertiesPanel({
  designCode,
  onCodeChange,
}: PropertiesPanelProps) {
  const {
    selectedElement,
    selectedBfId,
    setSelectedBfId,
    toggleProperties,
  } = useEditorStore();

  // Text editing state
  const [editingText, setEditingText] = React.useState(false);
  const [textValue, setTextValue] = React.useState("");
  const [editingAlt, setEditingAlt] = React.useState(false);
  const [altValue, setAltValue] = React.useState("");

  // Advanced classes
  const [addingClass, setAddingClass] = React.useState(false);
  const [newClassValue, setNewClassValue] = React.useState("");
  const addClassRef = React.useRef<HTMLInputElement>(null);

  // Sync text values on selection change
  React.useEffect(() => {
    setEditingText(false);
    setEditingAlt(false);
    if (selectedElement?.textContent) setTextValue(selectedElement.textContent);
    if (selectedElement?.attributes?.alt)
      setAltValue(selectedElement.attributes.alt);
  }, [
    selectedBfId,
    selectedElement?.textContent,
    selectedElement?.attributes?.alt,
  ]);

  React.useEffect(() => {
    if (addingClass && addClassRef.current) addClassRef.current.focus();
  }, [addingClass]);

  // Parse classes
  const selectedClasses = selectedElement?.classes;
  const parsed = React.useMemo<ParsedStyles | null>(() => {
    if (!selectedClasses) return null;
    return parseTailwindClasses(selectedClasses);
  }, [selectedClasses]);

  if (!selectedElement) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border/60 px-3 py-2">
          <h3 className="text-xs font-semibold">Properties</h3>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted-foreground">
            Select an element to edit
          </p>
        </div>
      </div>
    );
  }

  // ─── Mutation helpers ───────────────────────────────────────────

  const mutateAndSave = (mutator: (annotated: string) => string) => {
    const { annotatedCode } = injectBfIds(designCode);
    const updated = mutator(annotatedCode);
    const clean = stripBfIds(updated);
    if (clean !== designCode) onCodeChange(clean);
  };

  /** Replace a single class with a new value (or add/remove) */
  const handleSwapClass = (
    oldClass: string | null,
    newClass: string | null,
  ) => {
    if (!selectedBfId || !selectedElement.classes) return;
    const updated = swapClass(selectedElement.classes, oldClass, newClass);
    if (updated !== selectedElement.classes) {
      mutateAndSave((code) =>
        updateElementClasses(code, selectedBfId, updated),
      );
    }
  };

  const handleRemoveClass = (cls: string) => {
    if (!selectedBfId) return;
    mutateAndSave((code) => removeClassFromElement(code, selectedBfId, cls));
  };

  const handleAddClass = () => {
    if (!selectedBfId || !newClassValue.trim()) return;
    const classesToAdd = newClassValue.trim().split(/\s+/);
    mutateAndSave((code) => {
      let result = code;
      for (const cls of classesToAdd)
        result = addClassToElement(result, selectedBfId, cls);
      return result;
    });
    setNewClassValue("");
    setAddingClass(false);
  };

  const handleTextChange = () => {
    if (!selectedBfId || textValue === selectedElement.textContent) {
      setEditingText(false);
      return;
    }
    mutateAndSave((code) => updateElementText(code, selectedBfId, textValue));
    setEditingText(false);
  };

  const handleAltChange = () => {
    if (!selectedBfId) {
      setEditingAlt(false);
      return;
    }
    const currentAlt = selectedElement.attributes?.alt || "";
    if (altValue === currentAlt) {
      setEditingAlt(false);
      return;
    }
    mutateAndSave((code) =>
      updateElementAttribute(code, selectedBfId, "alt", altValue),
    );
    setEditingAlt(false);
  };

  // ─── Derived values ────────────────────────────────────────────

  const isImageElement = selectedElement.tag === "img";
  const currentAlt = selectedElement.attributes?.alt || "";
  const rect = selectedElement.rect;

  // Colors — from Tailwind classes, then fall back to computed/attributes
  const attrs = selectedElement.attributes;
  const bgHex = parsed?.bgColor
    ? twClassToHex(parsed.bgColor)
    : attrs?._computedBg && attrs._computedBg !== "rgba(0, 0, 0, 0)"
      ? rgbToHex(attrs._computedBg)
      : null;
  const textHex = parsed?.textColor
    ? twClassToHex(parsed.textColor)
    : attrs?._computedColor
      ? rgbToHex(attrs._computedColor)
      : null;
  const borderHex = parsed?.borderColor
    ? twClassToHex(parsed.borderColor)
    : null;
  // SVG fill/stroke from attributes
  const svgFill = attrs?.fill && attrs.fill !== "none" ? attrs.fill : null;
  const svgStroke = attrs?.stroke && attrs.stroke !== "none" ? attrs.stroke : null;

  // Font weight display value
  const fontWeightValue = parsed?.fontWeight
    ? parsed.fontWeight.replace("font-", "")
    : "normal";

  // Font size display value
  const fontSizeValue = parsed?.fontSize
    ? parsed.fontSize.replace("text-", "")
    : "";

  // Shadow display value
  const shadowValue = parsed?.shadow
    ? parsed.shadow === "shadow"
      ? ""
      : parsed.shadow.replace("shadow-", "")
    : "none";

  // Text align value
  const textAlignValue = parsed?.textAlign
    ? parsed.textAlign.replace("text-", "")
    : "";

  // Border radius display
  const borderRadiusValue = parsed?.borderRadius
    ? parsed.borderRadius === "rounded"
      ? "default"
      : parsed.borderRadius.replace("rounded-", "")
    : "";

  // Opacity display
  const opacityValue = parsed?.opacity
    ? parsed.opacity.replace("opacity-", "")
    : "100";

  // ─── Element type detection for section visibility ─────────────

  const tag = selectedElement.tag;
  const isSvgElement =
    tag === "svg" || tag === "path" || tag === "circle" || tag === "rect" ||
    tag === "line" || tag === "polyline" || tag === "polygon" || tag === "ellipse" ||
    tag === "g" || tag === "use" || tag === "defs" || tag === "clipPath";
  const isTextElement =
    tag === "p" || tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" ||
    tag === "h5" || tag === "h6" || tag === "span" || tag === "a" || tag === "label" ||
    tag === "strong" || tag === "em" || tag === "b" || tag === "i" || tag === "small" ||
    tag === "blockquote" || tag === "q" || tag === "cite" || tag === "code" || tag === "pre" ||
    tag === "li" || tag === "dt" || tag === "dd" || tag === "figcaption" || tag === "legend" ||
    tag === "caption" || tag === "th" || tag === "td";
  const isContainerElement =
    tag === "div" || tag === "section" || tag === "nav" || tag === "header" ||
    tag === "footer" || tag === "main" || tag === "article" || tag === "aside" ||
    tag === "ul" || tag === "ol" || tag === "form" || tag === "fieldset" ||
    tag === "figure" || tag === "details" || tag === "dialog" || tag === "table" ||
    tag === "thead" || tag === "tbody" || tag === "tr";
  const isInteractive =
    tag === "button" || tag === "input" || tag === "textarea" || tag === "select";

  // Section visibility — show if element type supports it OR already has the property
  const showPadding =
    !isSvgElement && (isContainerElement || isInteractive || isTextElement ||
    !!(parsed?.paddingTop || parsed?.paddingRight || parsed?.paddingBottom || parsed?.paddingLeft));
  const showFill =
    !isSvgElement
      ? (isContainerElement || isInteractive || isTextElement || isImageElement || !!parsed?.bgColor || !!bgHex)
      : !!svgFill;
  const showStroke =
    !isSvgElement
      ? (isContainerElement || isInteractive || !!parsed?.borderWidth || !!parsed?.borderColor || !!borderHex)
      : !!svgStroke;
  const showAppearance =
    !isSvgElement && (isContainerElement || isInteractive || isImageElement ||
    !!parsed?.opacity || !!parsed?.borderRadius);
  const showTypography =
    !isSvgElement && !isImageElement && (
      isTextElement || isInteractive ||
      !!parsed?.fontFamily || !!parsed?.fontWeight || !!parsed?.fontSize ||
      !!parsed?.lineHeight || !!parsed?.letterSpacing || !!parsed?.textAlign ||
      !!parsed?.textColor || !!textHex
    );
  const showEffects =
    !isSvgElement && (isContainerElement || isInteractive || isImageElement || !!parsed?.shadow);
  const showContent =
    !!selectedElement.textContent || isImageElement;

  return (
    <div className="flex h-full flex-col">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold capitalize">
            {selectedElement.tag}
          </h3>
          <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            &lt;{selectedElement.tag}&gt;
          </span>
        </div>
        <button
          onClick={() => {
            setSelectedBfId(null);
            toggleProperties();
          }}
          className="flex size-5 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Size & Position ───────────────────────────────────── */}
        <Section title="Size & Position">
          <div className="grid grid-cols-2 gap-2">
            <PropInput
              label="X Position"
              value={Math.round(rect.left).toString()}
              readOnly
            />
            <PropInput
              label="Y Position"
              value={Math.round(rect.top).toString()}
              readOnly
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <PropInput
              label="Width (px)"
              value={Math.round(rect.width).toString()}
              readOnly
            />
            <PropInput
              label="Height (px)"
              value={Math.round(rect.height).toString()}
              readOnly
            />
          </div>
          {(parsed?.width || parsed?.height || parsed?.maxWidth || parsed?.maxHeight) && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              {parsed?.width && (
                <PropInput
                  label="Width"
                  value={parsed.width.replace("w-", "")}
                  onChange={(v) =>
                    handleSwapClass(parsed.width, v ? `w-${v}` : null)
                  }
                />
              )}
              {parsed?.height && (
                <PropInput
                  label="Height"
                  value={parsed.height.replace("h-", "")}
                  onChange={(v) =>
                    handleSwapClass(parsed.height, v ? `h-${v}` : null)
                  }
                />
              )}
              {parsed?.maxWidth && (
                <PropInput
                  label="Max Width"
                  value={parsed.maxWidth.replace("max-w-", "")}
                  onChange={(v) =>
                    handleSwapClass(parsed.maxWidth, v ? `max-w-${v}` : null)
                  }
                />
              )}
              {parsed?.maxHeight && (
                <PropInput
                  label="Max Height"
                  value={parsed.maxHeight.replace("max-h-", "")}
                  onChange={(v) =>
                    handleSwapClass(
                      parsed.maxHeight,
                      v ? `max-h-${v}` : null,
                    )
                  }
                />
              )}
            </div>
          )}
        </Section>

        {/* ── Padding ───────────────────────────────────────────── */}
        {showPadding && <Section title="Padding">
          <div className="grid grid-cols-4 gap-2">
            <PropInput
              label="Top"
              value={extractPaddingValue(parsed?.paddingTop ?? null)}
              placeholder="0"
              onChange={(v) => {
                const old = parsed?.paddingTop ?? null;
                handleSwapClass(old, v ? `pt-${v}` : null);
              }}
            />
            <PropInput
              label="Right"
              value={extractPaddingValue(parsed?.paddingRight ?? null)}
              placeholder="0"
              onChange={(v) => {
                const old = parsed?.paddingRight ?? null;
                handleSwapClass(old, v ? `pr-${v}` : null);
              }}
            />
            <PropInput
              label="Bottom"
              value={extractPaddingValue(parsed?.paddingBottom ?? null)}
              placeholder="0"
              onChange={(v) => {
                const old = parsed?.paddingBottom ?? null;
                handleSwapClass(old, v ? `pb-${v}` : null);
              }}
            />
            <PropInput
              label="Left"
              value={extractPaddingValue(parsed?.paddingLeft ?? null)}
              placeholder="0"
              onChange={(v) => {
                const old = parsed?.paddingLeft ?? null;
                handleSwapClass(old, v ? `pl-${v}` : null);
              }}
            />
          </div>
        </Section>}

        {/* ── Fill ──────────────────────────────────────────────── */}
        {showFill && <Section title="Fill">
          <div className="space-y-2">
            <ColorInput
              hex={bgHex}
              onChange={(hex) => {
                const newClass = hexToTwClass(hex, "bg");
                handleSwapClass(parsed?.bgColor ?? null, newClass);
              }}
            />
            {!parsed?.bgColor && bgHex && (
              <p className="text-[10px] text-muted-foreground italic">Computed</p>
            )}
            {svgFill && (
              <div>
                <label className="mb-0.5 block text-[10px] text-muted-foreground">
                  SVG Fill
                </label>
                <div className="flex items-center gap-1.5">
                  <div
                    className="size-5 shrink-0 rounded border border-border/60"
                    style={{ backgroundColor: svgFill === "currentColor" ? (textHex || "#000") : svgFill }}
                  />
                  <span className="text-xs text-muted-foreground">{svgFill}</span>
                </div>
              </div>
            )}
          </div>
        </Section>}

        {/* ── Stroke ────────────────────────────────────────────── */}
        {showStroke && <Section title="Stroke">
          <div className="space-y-2">
            <ColorInput
              hex={borderHex}
              onChange={(hex) => {
                const newClass = hexToTwClass(hex, "border");
                handleSwapClass(parsed?.borderColor ?? null, newClass);
                // Ensure border width exists
                if (!parsed?.borderWidth) {
                  handleSwapClass(null, "border");
                }
              }}
            />
            {svgStroke && (
              <div>
                <label className="mb-0.5 block text-[10px] text-muted-foreground">
                  SVG Stroke
                </label>
                <div className="flex items-center gap-1.5">
                  <div
                    className="size-5 shrink-0 rounded border border-border/60"
                    style={{ backgroundColor: svgStroke === "currentColor" ? (textHex || "#000") : svgStroke }}
                  />
                  <span className="text-xs text-muted-foreground">{svgStroke}</span>
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <PropInput
                label="Width"
                value={
                  parsed?.borderWidth === "border"
                    ? "1"
                    : parsed?.borderWidth?.replace("border-", "") || "0"
                }
                onChange={(v) => {
                  const old = parsed?.borderWidth ?? null;
                  if (v === "0" || v === "") {
                    handleSwapClass(old, null);
                  } else if (v === "1") {
                    handleSwapClass(old, "border");
                  } else {
                    handleSwapClass(old, `border-${v}`);
                  }
                }}
              />
              <PropInput
                label="Radius"
                value={borderRadiusValue}
                placeholder="none"
                onChange={(v) => {
                  const old = parsed?.borderRadius ?? null;
                  if (!v || v === "none") {
                    handleSwapClass(old, null);
                  } else if (v === "default") {
                    handleSwapClass(old, "rounded");
                  } else {
                    handleSwapClass(old, `rounded-${v}`);
                  }
                }}
              />
            </div>
          </div>
        </Section>}

        {/* ── Appearance ────────────────────────────────────────── */}
        {showAppearance && <Section title="Appearance">
          <div className="grid grid-cols-2 gap-2">
            <PropInput
              label="Opacity (%)"
              value={opacityValue}
              onChange={(v) => {
                const old = parsed?.opacity ?? null;
                if (!v || v === "100") {
                  handleSwapClass(old, null);
                } else {
                  handleSwapClass(old, `opacity-${v}`);
                }
              }}
            />
            <PropInput
              label="Corner Radius"
              value={borderRadiusValue}
              placeholder="none"
              onChange={(v) => {
                const old = parsed?.borderRadius ?? null;
                if (!v || v === "none") {
                  handleSwapClass(old, null);
                } else if (v === "default") {
                  handleSwapClass(old, "rounded");
                } else {
                  handleSwapClass(old, `rounded-${v}`);
                }
              }}
            />
          </div>
        </Section>}

        {/* ── Typography ────────────────────────────────────────── */}
        {showTypography && <Section title="Typography">
          <div className="space-y-2">
            {/* Text Color */}
            <ColorInput
              label="Color"
              hex={textHex}
              onChange={(hex) => {
                const newClass = hexToTwClass(hex, "text");
                handleSwapClass(parsed?.textColor ?? null, newClass);
              }}
            />
            {!parsed?.textColor && textHex && (
              <p className="text-[10px] text-muted-foreground italic">Inherited</p>
            )}

            {/* Font Family */}
            {parsed?.fontFamily && (
              <PropInput
                label="Font"
                value={parsed.fontFamily
                  .replace("font-", "")
                  .replace(/^\['/, "")
                  .replace(/'\]$/, "")
                  .replace(/_/g, " ")}
                onChange={(v) => {
                  const old = parsed.fontFamily;
                  if (
                    v === "sans" ||
                    v === "serif" ||
                    v === "mono"
                  ) {
                    handleSwapClass(old, `font-${v}`);
                  } else if (v) {
                    handleSwapClass(
                      old,
                      `font-['${v.replace(/ /g, "_")}']`,
                    );
                  }
                }}
              />
            )}

            {/* Weight & Size */}
            <div className="grid grid-cols-2 gap-2">
              <SelectInput
                label="Weight"
                value={fontWeightValue}
                options={FONT_WEIGHTS.map((w) => ({
                  label: w.label,
                  value: w.value,
                }))}
                onChange={(v) => {
                  handleSwapClass(
                    parsed?.fontWeight ?? null,
                    `font-${v}`,
                  );
                }}
              />
              <SelectInput
                label="Size"
                value={fontSizeValue}
                options={[
                  { label: "—", value: "" },
                  ...FONT_SIZES.map((s) => ({ label: s, value: s })),
                ]}
                onChange={(v) => {
                  if (!v) {
                    handleSwapClass(parsed?.fontSize ?? null, null);
                  } else {
                    handleSwapClass(
                      parsed?.fontSize ?? null,
                      `text-${v}`,
                    );
                  }
                }}
              />
            </div>

            {/* Line Height & Letter Spacing */}
            <div className="grid grid-cols-2 gap-2">
              <PropInput
                label="Line H"
                value={
                  parsed?.lineHeight
                    ? parsed.lineHeight.replace("leading-", "")
                    : ""
                }
                placeholder="auto"
                onChange={(v) => {
                  handleSwapClass(
                    parsed?.lineHeight ?? null,
                    v ? `leading-${v}` : null,
                  );
                }}
              />
              <PropInput
                label="Letter Sp"
                value={
                  parsed?.letterSpacing
                    ? parsed.letterSpacing.replace("tracking-", "")
                    : ""
                }
                placeholder="normal"
                onChange={(v) => {
                  handleSwapClass(
                    parsed?.letterSpacing ?? null,
                    v ? `tracking-${v}` : null,
                  );
                }}
              />
            </div>

            {/* Alignment */}
            <div>
              <label className="mb-0.5 block text-[10px] text-muted-foreground">
                Alignment
              </label>
              <div className="flex gap-0.5">
                {[
                  { value: "left", icon: AlignLeft },
                  { value: "center", icon: AlignCenter },
                  { value: "right", icon: AlignRight },
                  { value: "justify", icon: AlignJustify },
                ].map(({ value, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    className={`flex size-7 items-center justify-center rounded transition-colors ${
                      textAlignValue === value
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    onClick={() => {
                      if (textAlignValue === value) {
                        handleSwapClass(parsed?.textAlign ?? null, null);
                      } else {
                        handleSwapClass(
                          parsed?.textAlign ?? null,
                          `text-${value}`,
                        );
                      }
                    }}
                  >
                    <Icon className="size-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Section>}

        {/* ── Effects ───────────────────────────────────────────── */}
        {showEffects && <Section title="Effects">
          <SelectInput
            label="Drop Shadow"
            value={shadowValue}
            options={SHADOW_OPTIONS}
            onChange={(v) => {
              const old = parsed?.shadow ?? null;
              if (v === "none") {
                handleSwapClass(old, null);
              } else if (v === "") {
                handleSwapClass(old, "shadow");
              } else {
                handleSwapClass(old, `shadow-${v}`);
              }
            }}
          />
        </Section>}

        {/* ── Text Content ──────────────────────────────────────── */}
        {showContent && (
          <Section title="Content">
            <div className="space-y-2">
              {/* Alt Text for images */}
              {isImageElement && (
                <div>
                  <label className="mb-0.5 block text-[10px] text-muted-foreground">
                    Alt Text
                  </label>
                  {editingAlt ? (
                    <input
                      type="text"
                      className="h-7 w-full rounded border border-border/60 bg-muted/30 px-2 text-xs focus:border-primary/50 focus:outline-none"
                      value={altValue}
                      onChange={(e) => setAltValue(e.target.value)}
                      onBlur={handleAltChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAltChange();
                        }
                        if (e.key === "Escape") {
                          setAltValue(currentAlt);
                          setEditingAlt(false);
                        }
                      }}
                      autoFocus
                    />
                  ) : (
                    <div
                      className="cursor-pointer rounded bg-muted/30 px-2 py-1 text-xs transition-colors hover:bg-muted"
                      onClick={() => {
                        setAltValue(currentAlt);
                        setEditingAlt(true);
                      }}
                    >
                      {currentAlt || "(no alt text)"}
                    </div>
                  )}
                </div>
              )}

              {/* Text Content */}
              {selectedElement.textContent && (
                <div>
                  <label className="mb-0.5 block text-[10px] text-muted-foreground">
                    Text
                  </label>
                  {editingText ? (
                    <textarea
                      className="w-full rounded border border-border/60 bg-muted/30 px-2 py-1 text-xs focus:border-primary/50 focus:outline-none resize-none"
                      value={textValue}
                      onChange={(e) => setTextValue(e.target.value)}
                      onBlur={handleTextChange}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleTextChange();
                        }
                        if (e.key === "Escape") {
                          setTextValue(selectedElement.textContent);
                          setEditingText(false);
                        }
                      }}
                      rows={3}
                      autoFocus
                    />
                  ) : (
                    <div
                      className="cursor-pointer rounded bg-muted/30 px-2 py-1 text-xs transition-colors hover:bg-muted line-clamp-3"
                      onClick={() => {
                        setTextValue(selectedElement.textContent);
                        setEditingText(true);
                      }}
                    >
                      {selectedElement.textContent}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Section>
        )}

        {/* ── Attributes ──────────────────────────────────────────── */}
        {attrs && (() => {
          const visibleAttrs = Object.entries(attrs).filter(
            ([key]) => !key.startsWith("_") && key !== "class",
          );
          if (visibleAttrs.length === 0) return null;
          return (
            <Section title="Attributes" defaultOpen={false}>
              <div className="space-y-1.5">
                {visibleAttrs.map(([key, val]) => (
                  <div key={key}>
                    <label className="block text-[10px] text-muted-foreground">
                      {key}
                    </label>
                    <div className="truncate rounded bg-muted/30 px-2 py-0.5 text-[10px] font-mono text-foreground">
                      {val.length > 60 ? val.slice(0, 60) + "…" : val}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          );
        })()}

        {/* ── Advanced / Raw Classes ────────────────────────────── */}
        {parsed && parsed.other.length > 0 && (
          <Section title="Classes" defaultOpen={false}>
            <div className="space-y-2">
              <div className="flex flex-wrap gap-1">
                {parsed.other.map((cls) => (
                  <span
                    key={cls}
                    className="inline-flex items-center gap-0.5 rounded bg-muted px-1.5 py-0.5 text-[10px]"
                  >
                    <span>{cls}</span>
                    <button
                      className="ml-0.5 text-muted-foreground hover:text-foreground"
                      onClick={() => handleRemoveClass(cls)}
                    >
                      &times;
                    </button>
                  </span>
                ))}
              </div>
              {addingClass ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddClass();
                  }}
                >
                  <input
                    ref={addClassRef}
                    type="text"
                    className="w-full rounded border border-primary/40 bg-transparent px-2 py-1 text-[10px] focus:outline-none"
                    placeholder="Add class..."
                    value={newClassValue}
                    onChange={(e) => setNewClassValue(e.target.value)}
                    onBlur={() => {
                      if (!newClassValue.trim()) setAddingClass(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setAddingClass(false);
                        setNewClassValue("");
                      }
                    }}
                  />
                </form>
              ) : (
                <button
                  className="rounded bg-muted px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => {
                    setAddingClass(true);
                    setNewClassValue("");
                  }}
                >
                  + Add Class
                </button>
              )}
            </div>
          </Section>
        )}

        {/* ── Element ID ────────────────────────────────────────── */}
        <div className="border-b border-border/40 px-3 py-2">
          <label className="block text-[10px] text-muted-foreground">
            ID
          </label>
          <div className="text-[10px] font-mono text-muted-foreground">
            {selectedElement.bfId}
          </div>
        </div>
      </div>
    </div>
  );
}
