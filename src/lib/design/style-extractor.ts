// Extracts structured style tokens from generated React/Tailwind design code
// Uses regex/string parsing — no AST required

export interface StyleTokens {
  fonts: {
    primary: string;
    secondary?: string;
    mono?: string;
  };
  colors: {
    background: string;
    foreground: string;
    accent: string;
    muted: string;
    border: string;
    [key: string]: string;
  };
  spacing: {
    sectionPadding: string;
    containerMaxWidth: string;
  };
  borderRadius: string;
  fontImport?: string;
}

// ── Tailwind color name → hex mapping (common values) ──────────────
const TW_COLORS: Record<string, string> = {
  'black': '#000000',
  'white': '#ffffff',
  'slate-50': '#f8fafc', 'slate-100': '#f1f5f9', 'slate-200': '#e2e8f0', 'slate-300': '#cbd5e1',
  'slate-400': '#94a3b8', 'slate-500': '#64748b', 'slate-600': '#475569', 'slate-700': '#334155',
  'slate-800': '#1e293b', 'slate-900': '#0f172a', 'slate-950': '#020617',
  'gray-50': '#f9fafb', 'gray-100': '#f3f4f6', 'gray-200': '#e5e7eb', 'gray-300': '#d1d5db',
  'gray-400': '#9ca3af', 'gray-500': '#6b7280', 'gray-600': '#4b5563', 'gray-700': '#374151',
  'gray-800': '#1f2937', 'gray-900': '#111827', 'gray-950': '#030712',
  'zinc-50': '#fafafa', 'zinc-100': '#f4f4f5', 'zinc-200': '#e4e4e7', 'zinc-300': '#d4d4d8',
  'zinc-400': '#a1a1aa', 'zinc-500': '#71717a', 'zinc-600': '#52525b', 'zinc-700': '#3f3f46',
  'zinc-800': '#27272a', 'zinc-900': '#18181b', 'zinc-950': '#09090b',
  'neutral-50': '#fafafa', 'neutral-100': '#f5f5f5', 'neutral-200': '#e5e5e5', 'neutral-300': '#d4d4d4',
  'neutral-400': '#a3a3a3', 'neutral-500': '#737373', 'neutral-600': '#525252', 'neutral-700': '#404040',
  'neutral-800': '#262626', 'neutral-900': '#171717', 'neutral-950': '#0a0a0a',
  'stone-50': '#fafaf9', 'stone-100': '#f5f5f4', 'stone-200': '#e7e5e4', 'stone-300': '#d6d3d1',
  'stone-400': '#a8a29e', 'stone-500': '#78716c', 'stone-600': '#57534e', 'stone-700': '#44403c',
  'stone-800': '#292524', 'stone-900': '#1c1917', 'stone-950': '#0c0a09',
  'red-500': '#ef4444', 'red-600': '#dc2626',
  'orange-500': '#f97316', 'orange-600': '#ea580c',
  'amber-500': '#f59e0b', 'amber-600': '#d97706',
  'yellow-500': '#eab308',
  'lime-500': '#84cc16',
  'green-500': '#22c55e', 'green-600': '#16a34a',
  'emerald-500': '#10b981', 'emerald-600': '#059669',
  'teal-500': '#14b8a6', 'teal-600': '#0d9488',
  'cyan-500': '#06b6d4',
  'sky-500': '#0ea5e9',
  'blue-500': '#3b82f6', 'blue-600': '#2563eb',
  'indigo-500': '#6366f1', 'indigo-600': '#4f46e5',
  'violet-500': '#8b5cf6', 'violet-600': '#7c3aed',
  'purple-500': '#a855f7', 'purple-600': '#9333ea',
  'fuchsia-500': '#d946ef',
  'pink-500': '#ec4899', 'pink-600': '#db2777',
  'rose-500': '#f43f5e', 'rose-600': '#e11d48',
};

// ── Tailwind border-radius classes → CSS values ─────────────────
const TW_RADIUS: Record<string, string> = {
  'rounded-none': '0',
  'rounded-sm': '0.125rem',
  'rounded': '0.25rem',
  'rounded-md': '0.375rem',
  'rounded-lg': '0.5rem',
  'rounded-xl': '0.75rem',
  'rounded-2xl': '1rem',
  'rounded-3xl': '1.5rem',
  'rounded-full': '9999px',
};

// ── Tailwind max-width classes → CSS values ──────────────────────
const TW_MAX_W: Record<string, string> = {
  'max-w-sm': '24rem',
  'max-w-md': '28rem',
  'max-w-lg': '32rem',
  'max-w-xl': '36rem',
  'max-w-2xl': '42rem',
  'max-w-3xl': '48rem',
  'max-w-4xl': '56rem',
  'max-w-5xl': '64rem',
  'max-w-6xl': '72rem',
  'max-w-7xl': '80rem',
};

// ── Tailwind padding classes → CSS values ────────────────────────
const TW_SPACING: Record<string, string> = {
  'py-8': '2rem', 'py-10': '2.5rem', 'py-12': '3rem',
  'py-16': '4rem', 'py-20': '5rem', 'py-24': '6rem',
  'py-28': '7rem', 'py-32': '8rem', 'py-36': '9rem',
  'py-40': '10rem', 'py-48': '12rem',
};

/**
 * Extract structured style tokens from generated React/Tailwind code.
 */
export function extractStyleTokens(code: string): StyleTokens {
  const fonts = extractFonts(code);
  const colors = extractColors(code);
  const spacing = extractSpacing(code);
  const borderRadius = extractBorderRadius(code);
  const fontImport = extractFontImport(code);

  return {
    fonts,
    colors,
    spacing,
    borderRadius,
    fontImport: fontImport || undefined,
  };
}

function extractFontImport(code: string): string | null {
  // Match @import url('...fonts.googleapis.com...')
  const importMatch = code.match(/@import\s+url\(['"]?(https:\/\/fonts\.googleapis\.com[^'")\s]+)['"]?\)/);
  return importMatch ? importMatch[1] : null;
}

function extractFonts(code: string): StyleTokens['fonts'] {
  const fonts: StyleTokens['fonts'] = { primary: 'system-ui' };

  // From Google Fonts import URL
  const importMatch = code.match(/fonts\.googleapis\.com\/css2\?family=([^&'")\s]+)/);
  if (importMatch) {
    const familyParam = decodeURIComponent(importMatch[1]);
    // e.g. "Space+Grotesk:wght@300;400;500;600;700"
    const fontName = familyParam.replace(/\+/g, ' ').replace(/:.*/, '');
    fonts.primary = fontName;
  }

  // From font-['FontName'] Tailwind class
  const fontClassMatches = code.matchAll(/font-\['([^']+)'\]/g);
  const fontClassNames = new Set<string>();
  for (const m of fontClassMatches) {
    fontClassNames.add(m[1].replace(/_/g, ' '));
  }

  // From fontFamily: 'FontName' or fontFamily: "'FontName'"
  const fontStyleMatches = code.matchAll(/fontFamily:\s*['"]'?([^'"]+)'?['"]/g);
  for (const m of fontStyleMatches) {
    fontClassNames.add(m[1].replace(/,.*/, '').trim());
  }

  // If we found font classes, use the first as primary (if we didn't get it from import)
  const fontNames = Array.from(fontClassNames).filter(
    (f) => !['system-ui', 'sans-serif', 'serif', 'monospace', 'inherit'].includes(f.toLowerCase())
  );
  if (fontNames.length > 0 && fonts.primary === 'system-ui') {
    fonts.primary = fontNames[0];
  }
  if (fontNames.length > 1) {
    fonts.secondary = fontNames[1];
  }

  // Check for monospace font
  const monoMatch = code.match(/font-mono|font-\['(JetBrains Mono|Fira Code|Source Code Pro|IBM Plex Mono|Roboto Mono)'\]/);
  if (monoMatch) {
    fonts.mono = monoMatch[1] || 'monospace';
  }

  return fonts;
}

function extractColors(code: string): StyleTokens['colors'] {
  const colorCounts = new Map<string, number>();

  // Extract hex colors from arbitrary Tailwind values: bg-[#hex], text-[#hex], border-[#hex]
  const arbitraryMatches = code.matchAll(/(?:bg|text|border|from|to|via|ring|shadow)-\[(#[0-9a-fA-F]{3,8})\]/g);
  for (const m of arbitraryMatches) {
    const hex = normalizeHex(m[1]);
    colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
  }

  // Extract named Tailwind colors: bg-slate-900, text-gray-100
  const namedMatches = code.matchAll(/(?:bg|text|border|from|to|via|ring)-([a-z]+-\d+)/g);
  for (const m of namedMatches) {
    const hex = TW_COLORS[m[1]];
    if (hex) {
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }
  }

  // Extract bg-black, bg-white, text-black, text-white
  const bwMatches = code.matchAll(/(?:bg|text)-(black|white)/g);
  for (const m of bwMatches) {
    const hex = TW_COLORS[m[1]];
    if (hex) {
      colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
    }
  }

  // Extract hex from inline styles: background: '#hex', color: '#hex', backgroundColor: '#hex'
  const styleHexMatches = code.matchAll(/(?:background(?:Color)?|color|borderColor):\s*['"]?(#[0-9a-fA-F]{3,8})['"]?/g);
  for (const m of styleHexMatches) {
    const hex = normalizeHex(m[1]);
    colorCounts.set(hex, (colorCounts.get(hex) || 0) + 1);
  }

  // Classify colors
  const allColors = Array.from(colorCounts.entries())
    .sort((a, b) => b[1] - a[1]); // most used first

  // Re-scan specifically for bg- and text- to classify
  const bgHexes = new Set<string>();
  const textHexes = new Set<string>();
  const borderHexes = new Set<string>();

  for (const m of code.matchAll(/bg-\[(#[0-9a-fA-F]{3,8})\]/g)) {
    bgHexes.add(normalizeHex(m[1]));
  }
  for (const m of code.matchAll(/bg-(black|white|[a-z]+-\d+)/g)) {
    const hex = TW_COLORS[m[1]];
    if (hex) bgHexes.add(hex);
  }
  for (const m of code.matchAll(/text-\[(#[0-9a-fA-F]{3,8})\]/g)) {
    textHexes.add(normalizeHex(m[1]));
  }
  for (const m of code.matchAll(/text-(black|white|[a-z]+-\d+)/g)) {
    const hex = TW_COLORS[m[1]];
    if (hex) textHexes.add(hex);
  }
  for (const m of code.matchAll(/border-\[(#[0-9a-fA-F]{3,8})\]/g)) {
    borderHexes.add(normalizeHex(m[1]));
  }
  for (const m of code.matchAll(/border-([a-z]+-\d+)/g)) {
    const hex = TW_COLORS[m[1]];
    if (hex) borderHexes.add(hex);
  }

  // Find background: most-used bg color
  const bgArray = Array.from(bgHexes);
  const mainBg = bgArray.length > 0
    ? bgArray.reduce((best, c) => (colorCounts.get(c) || 0) > (colorCounts.get(best) || 0) ? c : best, bgArray[0])
    : '#ffffff';

  // Find foreground: most-used text color
  const textArray = Array.from(textHexes);
  const mainFg = textArray.length > 0
    ? textArray.reduce((best, c) => (colorCounts.get(c) || 0) > (colorCounts.get(best) || 0) ? c : best, textArray[0])
    : '#111111';

  // Find accent: look for saturated colors (not gray/neutral) that aren't bg or fg
  const isGrayish = (hex: string) => {
    const rgb = hexToRgb(hex);
    if (!rgb) return true;
    const max = Math.max(rgb.r, rgb.g, rgb.b);
    const min = Math.min(rgb.r, rgb.g, rgb.b);
    return (max - min) < 30; // low saturation = grayish
  };

  const accentCandidates = allColors
    .map(([hex]) => hex)
    .filter((hex) => hex !== mainBg && hex !== mainFg && !isGrayish(hex));
  const accent = accentCandidates[0] || '#3b82f6';

  // Find muted: lighter text color, or a gray
  const mutedCandidates = textArray
    .filter((hex) => hex !== mainFg && isGrayish(hex));
  const muted = mutedCandidates[0] || '#6b7280';

  // Find border: from border-* or default
  const borderArray = Array.from(borderHexes);
  const border = borderArray[0] || '#e5e7eb';

  const result: StyleTokens['colors'] = {
    background: mainBg,
    foreground: mainFg,
    accent,
    muted,
    border,
  };

  // Add any additional accent colors
  if (accentCandidates.length > 1) {
    result['accent2'] = accentCandidates[1];
  }

  return result;
}

function extractSpacing(code: string): StyleTokens['spacing'] {
  // Find section padding (py-* on section-level elements)
  const pyMatches = code.matchAll(/(?:py-(\d+))/g);
  const pyCounts = new Map<string, number>();
  for (const m of pyMatches) {
    const cls = `py-${m[1]}`;
    pyCounts.set(cls, (pyCounts.get(cls) || 0) + 1);
  }

  // Most common section padding
  let sectionPadding = 'py-24'; // default
  if (pyCounts.size > 0) {
    sectionPadding = Array.from(pyCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  // Find container max-width
  const maxWMatches = code.matchAll(/max-w-(sm|md|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)/g);
  const maxWCounts = new Map<string, number>();
  for (const m of maxWMatches) {
    const cls = `max-w-${m[1]}`;
    maxWCounts.set(cls, (maxWCounts.get(cls) || 0) + 1);
  }

  let containerMaxWidth = 'max-w-6xl'; // default
  if (maxWCounts.size > 0) {
    containerMaxWidth = Array.from(maxWCounts.entries())
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  return {
    sectionPadding: TW_SPACING[sectionPadding] || sectionPadding,
    containerMaxWidth: TW_MAX_W[containerMaxWidth] || containerMaxWidth,
  };
}

function extractBorderRadius(code: string): string {
  const radiusMatches = code.matchAll(/rounded(?:-(sm|md|lg|xl|2xl|3xl|full|none))?/g);
  const radiusCounts = new Map<string, number>();
  for (const m of radiusMatches) {
    const cls = m[0];
    radiusCounts.set(cls, (radiusCounts.get(cls) || 0) + 1);
  }

  if (radiusCounts.size === 0) return '0.5rem';

  const mostCommon = Array.from(radiusCounts.entries())
    .sort((a, b) => b[1] - a[1])[0][0];

  return TW_RADIUS[mostCommon] || '0.5rem';
}

// ── Helpers ──────────────────────────────────────────────────────

function normalizeHex(hex: string): string {
  // Convert 3-char hex to 6-char
  if (hex.length === 4) {
    return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  return hex.toLowerCase();
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex);
  const match = normalized.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/);
  if (!match) return null;
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

/**
 * Format extracted tokens into a structured prompt section for the AI.
 */
export function formatTokensForPrompt(tokens: StyleTokens): string {
  const lines: string[] = [
    '## Design System Tokens (apply these EXACTLY — do NOT deviate)',
    '',
    `**Primary Font:** ${tokens.fonts.primary}${tokens.fontImport ? ` (import: ${tokens.fontImport})` : ''}`,
  ];

  if (tokens.fonts.secondary) {
    lines.push(`**Secondary Font:** ${tokens.fonts.secondary}`);
  }
  if (tokens.fonts.mono) {
    lines.push(`**Mono Font:** ${tokens.fonts.mono}`);
  }

  lines.push('');
  lines.push('**Colors:**');
  lines.push(`- Background: ${tokens.colors.background}`);
  lines.push(`- Foreground/text: ${tokens.colors.foreground}`);
  lines.push(`- Accent: ${tokens.colors.accent}`);
  lines.push(`- Muted text: ${tokens.colors.muted}`);
  lines.push(`- Borders: ${tokens.colors.border}`);
  if (tokens.colors.accent2) {
    lines.push(`- Secondary accent: ${tokens.colors.accent2}`);
  }

  lines.push('');
  lines.push(`**Section Padding:** ${tokens.spacing.sectionPadding}`);
  lines.push(`**Container Max Width:** ${tokens.spacing.containerMaxWidth}`);
  lines.push(`**Border Radius:** ${tokens.borderRadius}`);

  lines.push('');
  lines.push('Use these exact values. Match the font family, color palette, and spacing rhythm precisely.');

  return lines.join('\n');
}
