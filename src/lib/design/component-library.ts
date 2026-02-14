// Pre-built component section registry for the visual component picker

export type ComponentCategory =
  | 'navigation'
  | 'hero'
  | 'features'
  | 'social-proof'
  | 'pricing'
  | 'cta'
  | 'content'
  | 'footer';

export interface ComponentSection {
  id: string;
  name: string;
  category: ComponentCategory;
  description: string;
  thumbnail: string; // emoji for now
  promptSnippet: string; // injected into the AI prompt
  tags: string[];
}

export const CATEGORY_LABELS: Record<ComponentCategory, string> = {
  navigation: 'Navigation',
  hero: 'Hero',
  features: 'Features',
  'social-proof': 'Social Proof',
  pricing: 'Pricing',
  cta: 'Call to Action',
  content: 'Content',
  footer: 'Footer',
};

export const CATEGORY_ICONS: Record<ComponentCategory, string> = {
  navigation: '☰',
  hero: '◆',
  features: '⊞',
  'social-proof': '★',
  pricing: '◈',
  cta: '▶',
  content: '¶',
  footer: '▬',
};

export const COMPONENT_SECTIONS: ComponentSection[] = [
  // ── Navigation ─────────────────────────────────────────────
  {
    id: 'nav-sticky',
    name: 'Sticky Navbar',
    category: 'navigation',
    description: 'Fixed top nav with logo, links, and CTA button',
    thumbnail: '☰',
    promptSnippet: 'A sticky/fixed top navigation bar with logo on the left, horizontal nav links in the center, and a CTA button on the right. Clean and minimal.',
    tags: ['navbar', 'sticky', 'fixed', 'header'],
  },
  {
    id: 'nav-sidebar',
    name: 'Sidebar Nav',
    category: 'navigation',
    description: 'Vertical sidebar navigation for dashboards',
    thumbnail: '◧',
    promptSnippet: 'A vertical sidebar navigation on the left with icon+label nav items, grouped sections, and user avatar at the bottom. Dark background, suitable for dashboards.',
    tags: ['sidebar', 'dashboard', 'vertical', 'menu'],
  },
  {
    id: 'nav-transparent',
    name: 'Transparent Header',
    category: 'navigation',
    description: 'Overlay nav for hero sections with background images',
    thumbnail: '▽',
    promptSnippet: 'A transparent navigation header that overlays the hero section. White text, logo left, links center, CTA right. Designed to sit on top of a dark hero image or gradient.',
    tags: ['transparent', 'overlay', 'hero', 'header'],
  },

  // ── Hero ───────────────────────────────────────────────────
  {
    id: 'hero-centered',
    name: 'Centered Hero',
    category: 'hero',
    description: 'Large headline centered with subtitle and CTA',
    thumbnail: '◆',
    promptSnippet: 'A centered hero section with a large dramatic headline (text-5xl to text-7xl), a short subtitle below (text-base to text-lg max), and 1-2 CTA buttons. Generous vertical padding. No floating cards or decorations — let typography do the work.',
    tags: ['centered', 'headline', 'minimal', 'clean'],
  },
  {
    id: 'hero-split',
    name: 'Split Hero',
    category: 'hero',
    description: 'Text on left, image/visual on right',
    thumbnail: '◫',
    promptSnippet: 'A split hero with compelling copy on the left (headline, subtitle, CTA) and a large product image or illustration on the right. Two-column layout with balanced spacing.',
    tags: ['split', 'two-column', 'image', 'product'],
  },
  {
    id: 'hero-fullscreen',
    name: 'Fullscreen Hero',
    category: 'hero',
    description: 'Full viewport hero with background image',
    thumbnail: '▣',
    promptSnippet: 'A fullscreen hero section (min-h-screen) with a background image (with descriptive alt text), dark overlay, and centered white text. Dramatic and immersive. One headline, one line of subtext, one CTA.',
    tags: ['fullscreen', 'background', 'immersive', 'dramatic'],
  },
  {
    id: 'hero-gradient',
    name: 'Gradient Hero',
    category: 'hero',
    description: 'Bold gradient background with floating elements',
    thumbnail: '◇',
    promptSnippet: 'A hero section with a bold gradient background (not boring blue-purple — pick something distinctive). Large headline with maybe gradient text, minimal supporting text, and a single CTA.',
    tags: ['gradient', 'colorful', 'bold', 'modern'],
  },

  // ── Features ───────────────────────────────────────────────
  {
    id: 'features-grid',
    name: 'Feature Grid',
    category: 'features',
    description: '3-column grid of feature cards with icons',
    thumbnail: '⊞',
    promptSnippet: 'A features section with a section heading (text-2xl to text-3xl) and a 3-column grid of feature cards. Each card has an icon, title (text-lg max, font-semibold), and short description (text-sm). Clean spacing, consistent card styling.',
    tags: ['grid', 'cards', 'icons', '3-column'],
  },
  {
    id: 'features-alternating',
    name: 'Alternating Features',
    category: 'features',
    description: 'Image-text rows that alternate sides',
    thumbnail: '⇌',
    promptSnippet: 'An alternating features layout where each feature is a full-width row with image on one side and text on the other, alternating left-right. 2-3 features. Each has a title (text-lg), description (text-sm), and an image (with descriptive alt text).',
    tags: ['alternating', 'zigzag', 'image-text', 'rows'],
  },
  {
    id: 'features-bento',
    name: 'Bento Grid',
    category: 'features',
    description: 'Mixed-size cards in a bento box layout',
    thumbnail: '⊡',
    promptSnippet: 'A bento-style grid layout with mixed-size cards — some tall, some wide, some square. Each card highlights a feature with an icon or illustration, title (text-lg max), and one line of text (text-sm). Modern, editorial feel.',
    tags: ['bento', 'mosaic', 'mixed', 'editorial'],
  },
  {
    id: 'features-list',
    name: 'Feature List',
    category: 'features',
    description: 'Vertical list of features with checkmarks',
    thumbnail: '☑',
    promptSnippet: 'A vertical feature list with a section heading and a stacked list of features. Each feature has a check icon, title (text-base, font-semibold), and description (text-sm). Clean, easy to scan.',
    tags: ['list', 'checklist', 'vertical', 'simple'],
  },

  // ── Social Proof ───────────────────────────────────────────
  {
    id: 'testimonials-cards',
    name: 'Testimonial Cards',
    category: 'social-proof',
    description: 'Grid of customer testimonial cards',
    thumbnail: '★',
    promptSnippet: 'A testimonials section with a heading and a grid (2-3 columns) of testimonial cards. Each card has a quote (text-sm), star rating, customer name, title, and avatar (from i.pravatar.cc). Subtle card borders.',
    tags: ['testimonials', 'reviews', 'cards', 'quotes'],
  },
  {
    id: 'testimonials-single',
    name: 'Large Testimonial',
    category: 'social-proof',
    description: 'Single featured testimonial with large quote',
    thumbnail: '"',
    promptSnippet: 'A single large testimonial taking up the full width. Big quotation marks as decoration, the quote in text-xl (italic), followed by the customer name, title, and company. Centered layout, lots of breathing room.',
    tags: ['testimonial', 'featured', 'large', 'quote'],
  },
  {
    id: 'logos-bar',
    name: 'Logo Bar',
    category: 'social-proof',
    description: 'Row of partner/client logos',
    thumbnail: '◯',
    promptSnippet: 'A "Trusted by" or "Used by" logo bar showing 5-6 company logos in a horizontal row. Logos should be text-based placeholders (company names in gray). Centered, with subtle divider lines above/below.',
    tags: ['logos', 'clients', 'partners', 'trust'],
  },
  {
    id: 'stats-bar',
    name: 'Stats Bar',
    category: 'social-proof',
    description: 'Row of key metrics/numbers',
    thumbnail: '#',
    promptSnippet: 'A stats/metrics bar with 3-4 key numbers in a horizontal row. Each stat has a large number (text-3xl to text-4xl, font-bold), a label below (text-sm, text-muted). Clean dividers between stats.',
    tags: ['stats', 'metrics', 'numbers', 'data'],
  },

  // ── Pricing ────────────────────────────────────────────────
  {
    id: 'pricing-cards',
    name: 'Pricing Cards',
    category: 'pricing',
    description: '3-tier pricing table with highlighted plan',
    thumbnail: '◈',
    promptSnippet: 'A pricing section with 3 plan cards side by side. Each card has: plan name (text-lg, font-semibold), price (text-3xl), billing period (text-sm), feature list with checkmarks (text-sm), and CTA button. The middle card should be highlighted/featured.',
    tags: ['pricing', 'plans', 'tiers', 'cards'],
  },
  {
    id: 'pricing-simple',
    name: 'Simple Pricing',
    category: 'pricing',
    description: 'Minimal 2-plan comparison',
    thumbnail: '⊟',
    promptSnippet: 'A simple pricing section with just 2 plans: Free and Pro. Clean comparison with plan name, price, and a short list of included features (text-sm). One highlighted CTA. Minimal, no heavy card borders.',
    tags: ['pricing', 'simple', 'two-tier', 'minimal'],
  },

  // ── Call to Action ─────────────────────────────────────────
  {
    id: 'cta-banner',
    name: 'CTA Banner',
    category: 'cta',
    description: 'Full-width banner with strong call to action',
    thumbnail: '▶',
    promptSnippet: 'A full-width CTA banner section with a bold background color or gradient. Centered headline (text-2xl to text-3xl), one line of supporting text (text-base), and a contrasting CTA button. Strong visual weight to close the page.',
    tags: ['banner', 'cta', 'full-width', 'closing'],
  },
  {
    id: 'cta-split',
    name: 'Split CTA',
    category: 'cta',
    description: 'Two-column CTA with text and email input',
    thumbnail: '⇒',
    promptSnippet: 'A split CTA section with persuasive copy on the left (headline + one line of text) and an email signup form on the right (input + button). Could also be a newsletter signup. Clean, professional.',
    tags: ['split', 'email', 'signup', 'newsletter'],
  },
  {
    id: 'cta-minimal',
    name: 'Minimal CTA',
    category: 'cta',
    description: 'Simple centered CTA with just text and button',
    thumbnail: '→',
    promptSnippet: 'A minimal CTA section — just a centered headline (text-xl to text-2xl) and a single button below it. Maximum whitespace. The simplicity IS the design.',
    tags: ['minimal', 'simple', 'clean', 'centered'],
  },

  // ── Content ────────────────────────────────────────────────
  {
    id: 'content-faq',
    name: 'FAQ Accordion',
    category: 'content',
    description: 'Expandable FAQ section with questions and answers',
    thumbnail: '?',
    promptSnippet: 'An FAQ section with a heading and 5-6 expandable question/answer items. Each item has a question (text-base, font-semibold) and answer text (text-sm). Use a simple chevron icon for expand/collapse. Start with all collapsed.',
    tags: ['faq', 'accordion', 'questions', 'help'],
  },
  {
    id: 'content-blog-grid',
    name: 'Blog Card Grid',
    category: 'content',
    description: 'Grid of blog post preview cards',
    thumbnail: '▦',
    promptSnippet: 'A blog/articles section with a heading and a 3-column grid of blog post cards. Each card has: image (with descriptive alt text), category tag (text-xs), title (text-lg, font-semibold), excerpt (text-sm, 2 lines), date, and read more link.',
    tags: ['blog', 'articles', 'cards', 'grid'],
  },
  {
    id: 'content-team',
    name: 'Team Grid',
    category: 'content',
    description: 'Grid of team member cards with photos',
    thumbnail: '👤',
    promptSnippet: 'A team section with a heading and a 3-4 column grid of team member cards. Each card has: circular photo (from i.pravatar.cc), name (text-base, font-semibold), role (text-sm), and optional social links. Clean, professional layout.',
    tags: ['team', 'people', 'about', 'members'],
  },
  {
    id: 'content-steps',
    name: 'How It Works',
    category: 'content',
    description: 'Numbered steps showing a process',
    thumbnail: '①',
    promptSnippet: 'A "How it works" section with 3-4 numbered steps in a horizontal row. Each step has a number (large, styled), title (text-lg, font-semibold), and description (text-sm). Connected by lines or arrows between steps.',
    tags: ['steps', 'process', 'how-it-works', 'numbered'],
  },
  {
    id: 'content-comparison',
    name: 'Comparison Table',
    category: 'content',
    description: 'Feature comparison table with check/cross marks',
    thumbnail: '⊞',
    promptSnippet: 'A comparison table section showing features across 2-3 options. Row-based layout with feature names on the left and check/cross marks for each option. Clean borders, alternating row backgrounds. Header row with option names.',
    tags: ['comparison', 'table', 'versus', 'features'],
  },

  // ── Footer ─────────────────────────────────────────────────
  {
    id: 'footer-columns',
    name: 'Multi-Column Footer',
    category: 'footer',
    description: 'Footer with multiple link columns',
    thumbnail: '▬',
    promptSnippet: 'A multi-column footer with: logo and tagline on the left, 3-4 columns of categorized links (Product, Company, Resources, Legal) in the center/right, and a copyright line at the bottom. Dark background.',
    tags: ['footer', 'columns', 'links', 'comprehensive'],
  },
  {
    id: 'footer-simple',
    name: 'Simple Footer',
    category: 'footer',
    description: 'Minimal footer with copyright and social links',
    thumbnail: '—',
    promptSnippet: 'A minimal footer with logo, copyright text, and social media icon links in a single row. Subtle top border. Minimal height, clean.',
    tags: ['footer', 'simple', 'minimal', 'social'],
  },
  {
    id: 'footer-cta',
    name: 'Footer with CTA',
    category: 'footer',
    description: 'Footer combining CTA section with navigation',
    thumbnail: '▼',
    promptSnippet: 'A footer that combines a final CTA section at the top (headline + email input) with multi-column navigation links below, and copyright at the bottom. Two distinct visual zones.',
    tags: ['footer', 'cta', 'newsletter', 'comprehensive'],
  },
];

// Helper to get sections by category
export function getSectionsByCategory(category: ComponentCategory): ComponentSection[] {
  return COMPONENT_SECTIONS.filter((s) => s.category === category);
}

// Helper to search sections
export function searchSections(query: string): ComponentSection[] {
  const q = query.toLowerCase();
  return COMPONENT_SECTIONS.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some((t) => t.includes(q))
  );
}

// All categories in display order
export const CATEGORIES_ORDER: ComponentCategory[] = [
  'navigation',
  'hero',
  'features',
  'social-proof',
  'pricing',
  'cta',
  'content',
  'footer',
];
