export type DesignArchetype =
  | 'minimal'
  | 'bold'
  | 'editorial'
  | 'playful'
  | 'corporate'
  | 'brutalist'
  | 'luxe'
  | 'organic';

export interface ArchetypeInfo {
  label: string;
  description: string;
  promptDirective: string;
  previewColors: string[];
}

export const DESIGN_ARCHETYPES: Record<DesignArchetype, ArchetypeInfo> = {
  minimal: {
    label: 'Minimal',
    description: 'Clean & airy',
    previewColors: ['#fafafa', '#e5e5e5', '#737373', '#171717'],
    promptDirective: `THE ONE IDEA: Emptiness as design. The page should feel like 60% white space. Every element earns its place.

BACKGROUND: Warm off-white (#faf9f6 or #f7f5f2). Never pure white.
FONT: One thin sans-serif — Karla, Satoshi, or Instrument Sans. Font-light for headlines, font-normal text-base for body. Descriptions and card text in text-sm. Nothing between headline and body — the size gap IS the design.
COLORS: 2 neutrals (warm gray + charcoal) + ONE subtle accent used on exactly 1 element (a single CTA or underline).
BORDERS: 1px solid #e5e5e5 only. No shadows, no gradients.
RADIUS: 4px or 0px. Nothing bigger.
SECTIONS: Separated by 80px+ of empty space, not lines or backgrounds.
HERO: Left-aligned text, no image, no badge chip, no background pattern. Just the headline, a short sentence, and maybe one button. That's it.
ANIMATION: opacity 0→1 fade only. Duration 0.8s. No springs, no bounces, no slides.
NAV: 3 text links + logo. No background, no borders.
WHAT TO AVOID: Badge chips, gradient text, dark sections, card grids, ticker bars, floating elements. These all violate minimalism.

Reference mood: Reflect.app, huyml.co, Rauno Freiberg's personal site.`,
  },
  bold: {
    label: 'Bold',
    description: 'High contrast',
    previewColors: ['#000000', '#ffffff', '#6d28d9', '#f59e0b'],
    promptDirective: `THE ONE IDEA: Typography IS the design. Massive text. Dark backgrounds. One electric accent color.

BACKGROUND: #0a0a0a or #050505 for hero. Alternate with one vibrant full-bleed accent color section.
FONT: One impactful display font — Clash Display, Syne, or Space Grotesk. Headlines at text-6xl to text-8xl with leading-[0.9] and tracking-tighter. Font-bold for headlines, font-normal for body.
COLORS: Black + white + ONE saturated accent (violet #7c3aed, electric blue #2563eb, or hot orange #f97316). The accent appears on max 3 elements.
HERO: Full viewport height. One massive headline. One short line of body text. One CTA. NO floating cards, NO badge chips, NO scattered decorative elements. The typography alone carries the hero.
PICK ONE SIGNATURE EFFECT (not all of them):
  - Gradient text on the headline (bg-gradient-to-b from-white to-white/30 bg-clip-text text-transparent)
  - OR a subtle grid-line background texture (opacity-[0.03])
  - OR glassmorphism on ONE card section
  Never combine all three — that's AI slop.
BODY TEXT: #a1a1aa on dark backgrounds. Left-aligned. text-base. Card/feature titles: text-lg max with font-semibold. Card descriptions: text-sm.
ANIMATION: Slide up + fade. transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}.

Reference mood: Vercel.com, AuthKit.com, AnimeJS.com — notice how they commit to ONE strong idea per section.`,
  },
  editorial: {
    label: 'Editorial',
    description: 'Magazine layout',
    previewColors: ['#faf9f6', '#1a1a1a', '#8b7355', '#d4c5a9'],
    promptDirective: `THE ONE IDEA: This is a magazine, not a website. Content-first. Asymmetric layouts. Type-driven hierarchy.

BACKGROUND: Warm paper (#faf9f6) as primary. One section can use deep charcoal (#1a1a1a).
FONT: A serif for headlines (Playfair Display, DM Serif Display, or Newsreader) paired with a clean sans for body (DM Sans or Inter). Headlines in font-light italic at text-5xl+. Body in font-normal text-base with leading-[1.8].
COLORS: Ink black (#1a1a1a) + warm stone (#8b7355 or #a0916b) + paper (#faf9f6). That's it. No bright accents.
LAYOUT: This is the key differentiator. Use asymmetric grids everywhere:
  - Hero: grid-cols-[2fr_1fr] with text on one side, image or pull-quote on the other
  - Content sections: grid-cols-[1fr_1.5fr] with a sticky sidebar label
  - Never center everything — editorial layouts are offset and dynamic
DETAILS: tracked-out uppercase labels (text-xs tracking-[0.2em] uppercase text-stone-400), thin horizontal rules as section dividers, generous leading on body text.
HERO: NO badge chip, NO gradient text. A large serif headline with a short subhead and editorial-style byline. Think magazine cover, not SaaS landing page.
ANIMATION: Gentle fade-in. Nothing flashy.

Reference mood: Linear.app/change, Hex.tech, The New York Times features.`,
  },
  playful: {
    label: 'Playful',
    description: 'Fun & friendly',
    previewColors: ['#fef3c7', '#6ee7b7', '#f472b6', '#818cf8'],
    promptDirective: `THE ONE IDEA: Warmth and personality. This site should make you smile — not through gimmicks, but through color, rounded shapes, and friendly copy.

BACKGROUND: Soft pastels — lavender (#f5f3ff), warm cream (#fefce8), or soft mint (#ecfdf5). ONE main bg color, not a rainbow.
FONT: Rounded friendly sans — Nunito, Quicksand, or Plus Jakarta Sans. Headlines in font-semibold (not bold) at text-4xl to text-5xl. Body in font-normal text-base. Card descriptions in text-sm.
COLORS: Pick ONE pastel-to-saturated gradient palette. E.g., lavender (#ede9fe) + violet (#7c3aed), or mint (#d1fae5) + emerald (#059669). Use the saturated version on 2-3 CTAs/accents. Everything else is the pastel.
RADIUS: 16px on cards, 9999px (rounded-full) on buttons. No sharp corners anywhere.
HERO: Approachable and inviting. Large friendly headline, conversational subhead, one big rounded CTA button. Consider a product screenshot or illustration — NOT decorative floating cards.
ANIMATION: Bouncy springs — transition={{ type: "spring", stiffness: 200, damping: 20 }}. Scale on hover (1.03, not 1.1). Keep it subtle — playful, not chaotic.
COPY: Conversational, first-person. "We built this because..." not "Introducing the next generation of..."
NAV: Can be a pill-shaped bar (rounded-full) with soft background. Keep it simple.
WHAT TO AVOID: Dark backgrounds, gradient text, monospace fonts, harsh borders. These kill the playful feeling.

Reference mood: Phantom.com, Figma.com, Notion.so.`,
  },
  corporate: {
    label: 'Corporate',
    description: 'Professional',
    previewColors: ['#f8fafc', '#1e293b', '#3b82f6', '#64748b'],
    promptDirective: `THE ONE IDEA: Trustworthy and proven. This is a company that handles billions of dollars — the design radiates competence, not creativity.

BACKGROUND: #f8fafc (cool off-white). One section can use #0f172a (dark slate) for contrast.
FONT: IBM Plex Sans or Inter. Nothing experimental. Headlines in font-semibold text-4xl. Body in font-normal text-base. Everything feels measured and precise.
COLORS: Slate (#334155, #64748b) + one professional blue (#2563eb) or teal (#0d9488). No bright colors. No gradients.
LAYOUT: Clean grid-based structure. max-w-6xl centered. Cards with shadow-sm and rounded-lg. Everything aligned to a grid.
HERO: Product-forward. Show a screenshot of the actual product (use a placeholder image with descriptive alt text), or a clean split layout with headline left and visual right. NO decorative elements, NO floating shapes.
SOCIAL PROOF: One logo ticker bar OR one "trusted by X companies" section. Not both. Logos should be grayscale, opacity-40.
SECTIONS: Clear headers (text-2xl font-semibold), organized content, obvious hierarchy. Card and feature descriptions must be text-sm or text-base, never larger. Think: someone's VP needs to approve this.
ANIMATION: Minimal. Fade-in on scroll, subtle hover states on cards. No springs, no bouncing.
WHAT TO AVOID: Playful copy, experimental layouts, oversized typography, glassmorphism, grid-line backgrounds. This isn't a startup landing page.

Reference mood: Stripe.com/sessions, Acctual.com, Linear.app (the product, not /change).`,
  },
  brutalist: {
    label: 'Brutalist',
    description: 'Raw & striking',
    previewColors: ['#ffffff', '#000000', '#ff0000', '#cccccc'],
    promptDirective: `THE ONE IDEA: Break every convention. This design should make you uncomfortable in a good way — nothing is where you expect it.

BACKGROUND: Pure white (#ffffff) or pure black (#000000). Nothing in between. No gradients.
FONT: Monospace or grotesque — JetBrains Mono, Space Grotesk, or Archivo Black. ONE font only. Headlines can be absurdly large (text-[8rem] to text-[12rem]) with leading-[0.75] — so big they bleed off the viewport edge (use overflow-hidden on the container). Body text stays small: text-sm max. The extreme contrast between massive headlines and tiny body text IS brutalism.
COLORS: Black + white + ONE violent accent (red #ef4444, yellow #eab308, or green #22c55e). The accent appears on exactly 1-2 elements.
BORDERS: 2px+ solid black. Visible, structural. No rounded corners anywhere — all edges are sharp.
LAYOUT: Anti-conventional. Pin elements to viewport edges instead of centering them. Text can be right-aligned or flush to the left edge. Sections can be 80vh of empty space with a single word. The grid can be broken — overlapping elements, unequal columns, content that doesn't align.
HERO: Extreme. Maybe just one word filling the entire viewport. Maybe text so large you can only see part of it. Maybe a single line pinned to the bottom of the screen. NO hero images, NO badge chips, NO cards.
ANIMATION: None, or a single jarring cut transition. Smoothness = softness = wrong for brutalism.
COPY: Direct, stripped, honest. Short sentences. No marketing fluff at all.

Reference mood: SavoirFaire.nyc, Bloomberg Businessweek redesign, Swiss international style posters.`,
  },
  luxe: {
    label: 'Luxe',
    description: 'Premium feel',
    previewColors: ['#0a0a0a', '#1a1a1a', '#c9a96e', '#f5f0e8'],
    promptDirective: `THE ONE IDEA: Silence and restraint. This design whispers luxury through what it DOESN'T show. Maximum whitespace, minimum elements.

BACKGROUND: Rich black (#0a0a0a or #080808). Every section uses this same dark background.
FONT: Elegant serif — Cormorant Garamond, Bodoni Moda, or Playfair Display. Headlines in font-light (not bold!) at text-5xl to text-6xl with tracking-wide. Body text in a subtle sans-serif at text-sm, color #737373.
COLORS: Black + off-white (#f5f0e8) + ONE warm metallic accent (#c9a96e gold or #b8977e bronze). The accent appears ONLY on thin horizontal rules and maybe one CTA border. No bright colors ever.
SPACING: Extreme padding — py-40 or py-48 between sections. Let the page breathe. A section with a single centered sentence and 200px of padding above and below is perfect.
HERO: Full viewport. Minimal text — a short elegant headline, a one-line subhead in small caps, maybe a thin gold rule. Consider a full-bleed background photo (with descriptive alt text) with minimal text overlay. NO buttons, NO badges, NO cards.
TYPOGRAPHY DETAILS: tracking-[0.2em] on all uppercase text. Thin horizontal rules (h-px bg-white/10) as dividers. Sparse, intentional placement.
NAV: Minimal — logo left, 2-3 links right, all in tracking-[0.15em] uppercase text-xs.
ANIMATION: Slow fades only. duration: 1.2, ease: [0.22, 1, 0.36, 1]. No springs.
WHAT TO AVOID: Gradient text, card grids, badge chips, ticker bars, glassmorphism. Luxury is about absence, not addition.

Reference mood: Maison Margiela, Silencio.es, Celine.com, Bottega Veneta.`,
  },
  organic: {
    label: 'Organic',
    description: 'Warm & natural',
    previewColors: ['#faf7f2', '#5f7161', '#c17f59', '#e8dcc8'],
    promptDirective: `THE ONE IDEA: Warmth and texture. This design should feel like holding a handmade ceramic mug — earthy, tactile, imperfect in a beautiful way.

BACKGROUND: Warm cream (#faf7f2 or #f5efe6) as the primary. Sections transition between cream, sage (#e8efe8), and sand (#e8dcc8). Never use pure white or any cool-toned background.
FONT: Soft humanist sans — DM Sans, Outfit, or Plus Jakarta Sans. Headlines in font-normal (NOT bold) at text-4xl to text-5xl. Body in text-base with leading-[1.8].
COLORS: Sage green (#5f7161), terracotta (#c17f59), sand (#e8dcc8), deep forest (#2d3b2e). All muted, all warm. No saturated or cool colors.
RADIUS: 16px-24px on everything. Soft, rounded shapes.
TEXTURE: One subtle decorative element — a large blur blob (absolute, w-96, h-96, bg-sage/10, blur-3xl) or soft CSS gradient transitions between sections. Not both.
HERO: Warm and grounded. A gentle headline, earthy imagery (use a placeholder image with descriptive alt text), generous spacing. Consider an asymmetric layout with a large photo on one side.
SECTIONS: Flow into each other with subtle background color shifts (cream → sage → cream → terracotta). No hard borders between sections.
ANIMATION: Gentle, slow. duration: 0.8, ease: [0.22, 1, 0.36, 1]. Fade up, never slide sideways.
COPY: Warm, personal, unhurried. "Crafted with care" not "Powered by AI."

Reference mood: Aesop.com, Cup of Couple, The Raw Materials, Kinfolk magazine.`,
  },
};

export const ARCHETYPE_KEYS = Object.keys(DESIGN_ARCHETYPES) as DesignArchetype[];

export function getRandomArchetype(): DesignArchetype {
  return ARCHETYPE_KEYS[Math.floor(Math.random() * ARCHETYPE_KEYS.length)];
}
