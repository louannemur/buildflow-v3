/**
 * Parses Tailwind class strings into structured property objects
 * and provides utilities for swapping individual classes.
 */

import { TW_COLORS } from "./style-extractor";

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface ParsedStyles {
  // Size
  width: string | null;
  height: string | null;
  maxWidth: string | null;
  maxHeight: string | null;

  // Padding
  paddingTop: string | null;
  paddingRight: string | null;
  paddingBottom: string | null;
  paddingLeft: string | null;

  // Background
  bgColor: string | null;

  // Border
  borderWidth: string | null;
  borderColor: string | null;
  borderRadius: string | null;

  // Opacity
  opacity: string | null;

  // Typography
  fontFamily: string | null;
  fontWeight: string | null;
  fontSize: string | null;
  lineHeight: string | null;
  letterSpacing: string | null;
  textAlign: string | null;
  textColor: string | null;

  // Shadow
  shadow: string | null;

  // Remaining
  other: string[];
}

/* ─── Regex patterns ─────────────────────────────────────────────────── */

const PATTERNS: Record<string, RegExp> = {
  width: /^w-(.+)$/,
  height: /^h-(.+)$/,
  maxWidth: /^max-w-(.+)$/,
  maxHeight: /^max-h-(.+)$/,

  // Individual padding
  paddingAll: /^p-(.+)$/,
  paddingX: /^px-(.+)$/,
  paddingY: /^py-(.+)$/,
  paddingTop: /^pt-(.+)$/,
  paddingRight: /^pr-(.+)$/,
  paddingBottom: /^pb-(.+)$/,
  paddingLeft: /^pl-(.+)$/,

  // Background (skip gradient prefixes like bg-gradient-*)
  bgColor: /^bg-(?!gradient|clip|origin|repeat|scroll|fixed|local|no-repeat|cover|contain|center|top|bottom|left|right|none)(.+)$/,

  // Border
  borderWidthPlain: /^border$/,
  borderWidthSized: /^border-(\d+)$/,
  borderColor: /^border-(?!t$|r$|b$|l$|x$|y$|collapse|separate|spacing|dashed|dotted|double|hidden|none|solid)(.+)$/,
  borderRadius: /^rounded(?:-(.+))?$/,

  // Opacity
  opacity: /^opacity-(.+)$/,

  // Typography
  fontFamily: /^font-(sans|serif|mono|\[.+\])$/,
  fontWeight: /^font-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)$/,
  fontSize: /^text-(xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|8xl|9xl|\[.+\])$/,
  lineHeight: /^leading-(.+)$/,
  letterSpacing: /^tracking-(.+)$/,
  textAlign: /^text-(left|center|right|justify|start|end)$/,
  textColor: /^text-(?!xs$|sm$|base$|lg$|xl$|2xl$|3xl$|4xl$|5xl$|6xl$|7xl$|8xl$|9xl$|left$|center$|right$|justify$|start$|end$|wrap$|nowrap$|ellipsis$|clip$|balance$|pretty$)(.+)$/,

  // Shadow
  shadow: /^shadow(?:-(.+))?$/,
};

/* ─── Font weight mappings ───────────────────────────────────────────── */

export const FONT_WEIGHTS = [
  { label: "Thin", value: "thin", numeric: "100" },
  { label: "Extra Light", value: "extralight", numeric: "200" },
  { label: "Light", value: "light", numeric: "300" },
  { label: "Regular", value: "normal", numeric: "400" },
  { label: "Medium", value: "medium", numeric: "500" },
  { label: "Semibold", value: "semibold", numeric: "600" },
  { label: "Bold", value: "bold", numeric: "700" },
  { label: "Extra Bold", value: "extrabold", numeric: "800" },
  { label: "Black", value: "black", numeric: "900" },
];

export const FONT_SIZES = [
  "xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl",
];

export const SHADOW_OPTIONS = [
  { label: "None", value: "none" },
  { label: "SM", value: "sm" },
  { label: "Default", value: "" },
  { label: "MD", value: "md" },
  { label: "LG", value: "lg" },
  { label: "XL", value: "xl" },
  { label: "2XL", value: "2xl" },
];

/* ─── Parser ─────────────────────────────────────────────────────────── */

export function parseTailwindClasses(classStr: string): ParsedStyles {
  const classes = classStr.split(/\s+/).filter(Boolean);
  const result: ParsedStyles = {
    width: null,
    height: null,
    maxWidth: null,
    maxHeight: null,
    paddingTop: null,
    paddingRight: null,
    paddingBottom: null,
    paddingLeft: null,
    bgColor: null,
    borderWidth: null,
    borderColor: null,
    borderRadius: null,
    opacity: null,
    fontFamily: null,
    fontWeight: null,
    fontSize: null,
    lineHeight: null,
    letterSpacing: null,
    textAlign: null,
    textColor: null,
    shadow: null,
    other: [],
  };

  for (const cls of classes) {
    let matched = false;

    // Size
    if (PATTERNS.width.test(cls)) { result.width = cls; matched = true; }
    else if (PATTERNS.height.test(cls)) { result.height = cls; matched = true; }
    else if (PATTERNS.maxWidth.test(cls)) { result.maxWidth = cls; matched = true; }
    else if (PATTERNS.maxHeight.test(cls)) { result.maxHeight = cls; matched = true; }

    // Padding — individual sides take priority over shorthands
    else if (PATTERNS.paddingTop.test(cls)) { result.paddingTop = cls; matched = true; }
    else if (PATTERNS.paddingRight.test(cls)) { result.paddingRight = cls; matched = true; }
    else if (PATTERNS.paddingBottom.test(cls)) { result.paddingBottom = cls; matched = true; }
    else if (PATTERNS.paddingLeft.test(cls)) { result.paddingLeft = cls; matched = true; }
    else if (PATTERNS.paddingY.test(cls)) {
      const val = cls.match(PATTERNS.paddingY)![1];
      if (!result.paddingTop) result.paddingTop = `pt-${val}`;
      if (!result.paddingBottom) result.paddingBottom = `pb-${val}`;
      matched = true;
    }
    else if (PATTERNS.paddingX.test(cls)) {
      const val = cls.match(PATTERNS.paddingX)![1];
      if (!result.paddingRight) result.paddingRight = `pr-${val}`;
      if (!result.paddingLeft) result.paddingLeft = `pl-${val}`;
      matched = true;
    }
    else if (PATTERNS.paddingAll.test(cls)) {
      const val = cls.match(PATTERNS.paddingAll)![1];
      if (!result.paddingTop) result.paddingTop = `pt-${val}`;
      if (!result.paddingRight) result.paddingRight = `pr-${val}`;
      if (!result.paddingBottom) result.paddingBottom = `pb-${val}`;
      if (!result.paddingLeft) result.paddingLeft = `pl-${val}`;
      matched = true;
    }

    // Background
    else if (PATTERNS.bgColor.test(cls)) { result.bgColor = cls; matched = true; }

    // Border
    else if (PATTERNS.borderWidthPlain.test(cls)) { result.borderWidth = cls; matched = true; }
    else if (PATTERNS.borderWidthSized.test(cls)) { result.borderWidth = cls; matched = true; }
    else if (PATTERNS.borderRadius.test(cls)) { result.borderRadius = cls; matched = true; }
    else if (PATTERNS.borderColor.test(cls)) { result.borderColor = cls; matched = true; }

    // Opacity
    else if (PATTERNS.opacity.test(cls)) { result.opacity = cls; matched = true; }

    // Typography — check weight and family before generic font-* to avoid conflicts
    else if (PATTERNS.fontWeight.test(cls)) { result.fontWeight = cls; matched = true; }
    else if (PATTERNS.fontFamily.test(cls)) { result.fontFamily = cls; matched = true; }
    else if (PATTERNS.textAlign.test(cls)) { result.textAlign = cls; matched = true; }
    else if (PATTERNS.fontSize.test(cls)) { result.fontSize = cls; matched = true; }
    else if (PATTERNS.textColor.test(cls)) { result.textColor = cls; matched = true; }
    else if (PATTERNS.lineHeight.test(cls)) { result.lineHeight = cls; matched = true; }
    else if (PATTERNS.letterSpacing.test(cls)) { result.letterSpacing = cls; matched = true; }

    // Shadow
    else if (PATTERNS.shadow.test(cls)) { result.shadow = cls; matched = true; }

    if (!matched) {
      result.other.push(cls);
    }
  }

  return result;
}

/* ─── Builder ────────────────────────────────────────────────────────── */

export function buildClassString(parsed: ParsedStyles): string {
  const parts: string[] = [];

  // Size
  if (parsed.width) parts.push(parsed.width);
  if (parsed.height) parts.push(parsed.height);
  if (parsed.maxWidth) parts.push(parsed.maxWidth);
  if (parsed.maxHeight) parts.push(parsed.maxHeight);

  // Padding
  if (parsed.paddingTop) parts.push(parsed.paddingTop);
  if (parsed.paddingRight) parts.push(parsed.paddingRight);
  if (parsed.paddingBottom) parts.push(parsed.paddingBottom);
  if (parsed.paddingLeft) parts.push(parsed.paddingLeft);

  // Background
  if (parsed.bgColor) parts.push(parsed.bgColor);

  // Border
  if (parsed.borderWidth) parts.push(parsed.borderWidth);
  if (parsed.borderColor) parts.push(parsed.borderColor);
  if (parsed.borderRadius) parts.push(parsed.borderRadius);

  // Opacity
  if (parsed.opacity) parts.push(parsed.opacity);

  // Typography
  if (parsed.fontFamily) parts.push(parsed.fontFamily);
  if (parsed.fontWeight) parts.push(parsed.fontWeight);
  if (parsed.fontSize) parts.push(parsed.fontSize);
  if (parsed.lineHeight) parts.push(parsed.lineHeight);
  if (parsed.letterSpacing) parts.push(parsed.letterSpacing);
  if (parsed.textAlign) parts.push(parsed.textAlign);
  if (parsed.textColor) parts.push(parsed.textColor);

  // Shadow
  if (parsed.shadow) parts.push(parsed.shadow);

  // Other
  parts.push(...parsed.other);

  return parts.join(" ");
}

/* ─── Class swap helper ──────────────────────────────────────────────── */

/**
 * Replace one class in a class string with another.
 * If oldClass is null, appends newClass.
 * If newClass is null, removes oldClass.
 */
export function swapClass(
  classStr: string,
  oldClass: string | null,
  newClass: string | null,
): string {
  const classes = classStr.split(/\s+/).filter(Boolean);

  if (oldClass && newClass) {
    const idx = classes.indexOf(oldClass);
    if (idx >= 0) {
      classes[idx] = newClass;
    } else {
      classes.push(newClass);
    }
  } else if (oldClass && !newClass) {
    const idx = classes.indexOf(oldClass);
    if (idx >= 0) classes.splice(idx, 1);
  } else if (!oldClass && newClass) {
    classes.push(newClass);
  }

  return classes.join(" ");
}

/* ─── Color utilities ────────────────────────────────────────────────── */

/**
 * Extract hex color from a Tailwind color class value.
 * e.g. "bg-blue-500" → "#3b82f6", "bg-[#ff0000]" → "#ff0000"
 */
export function twClassToHex(twClass: string): string | null {
  // Arbitrary value: bg-[#hex] or text-[#hex]
  const arbitraryMatch = twClass.match(/\[(#[0-9a-fA-F]{3,8})\]/);
  if (arbitraryMatch) return arbitraryMatch[1];

  // Named color: extract the color part after the prefix
  const colorMatch = twClass.match(/(?:bg|text|border|ring|from|to|via)-(.+?)(?:\/\d+)?$/);
  if (colorMatch) {
    const colorName = colorMatch[1];
    if (colorName === "black") return "#000000";
    if (colorName === "white") return "#ffffff";
    if (colorName === "transparent") return null;
    if (colorName === "current") return null;
    return TW_COLORS[colorName] || null;
  }

  return null;
}

/**
 * Build a Tailwind color class from a hex value.
 * e.g. "#ff0000" + "bg" → "bg-[#ff0000]"
 */
export function hexToTwClass(hex: string, prefix: "bg" | "text" | "border"): string {
  return `${prefix}-[${hex}]`;
}

/**
 * Extract the display value from a Tailwind class (the part after the prefix).
 * e.g. "w-full" → "full", "pt-4" → "4", "text-lg" → "lg"
 */
export function extractValue(twClass: string): string {
  const match = twClass.match(/^[a-z-]+-(.+)$/);
  return match ? match[1] : twClass;
}

/**
 * Extract padding value number from a padding class.
 * e.g. "pt-4" → "4", "pb-[20px]" → "[20px]"
 */
export function extractPaddingValue(twClass: string | null): string {
  if (!twClass) return "";
  const match = twClass.match(/^p[trbl]-(.+)$/);
  return match ? match[1] : "";
}
