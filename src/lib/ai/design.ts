import { ai, GEMINI_MODEL } from "./gemini";
import { DESIGN_ARCHETYPES } from "@/lib/design/design-archetypes";
import {
  extractStyleTokens,
  formatTokensForPrompt,
} from "@/lib/design/style-extractor";
import { extractHtmlFromResponse } from "./extract-code";

// Re-export for backwards compat
export { extractCodeFromResponse, extractHtmlFromResponse } from "./extract-code";

// ── Prompt Constants ─────────────────────────────────────────────

const DESIGN_SYSTEM_PROMPT = `You are a world-class web designer who has won multiple Awwwards and FWA awards. You design sites featured on godly.website. You have ONE job: create a design so striking that someone screenshots it and shares it. Every design you make should look like a human designer spent days on it — not something an AI generated in seconds.

THE ONE IDEA RULE: Before writing any code, decide on ONE dominant visual concept for the entire page. Not three, not five — ONE. Examples: "typography-led with a single massive serif headline," or "dark with a single glowing accent color," or "warm cream editorial with asymmetric photo layout." Every element must serve this single concept. If an element doesn't reinforce the concept, delete it.

Output: A complete, single-file HTML document. Tailwind utility classes and inline styles only. Brief commentary before and after code only. Don't mention Tailwind or tokens in the output.

CRITICAL RULES:
- Output a full HTML document with <!DOCTYPE html>, <html>, <head>, and <body> tags
- Use Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
- Do NOT use React, JSX, Vue, or any framework syntax. Plain HTML + Tailwind + vanilla JS only.
- All styling via Tailwind utility classes or inline style attributes. No separate CSS files.
- Add data-bf-id="bf_[8 random alphanumeric chars]" to EVERY element in the body (including nested elements like spans, divs, links, images, buttons, etc.)

[Typography — the #1 differentiator]:
Load ONE Google Font that perfectly matches the project's personality. This is the most important decision — the wrong font ruins everything. Never default to Inter.
- Fintech/dev tools → Space Grotesk, JetBrains Mono, IBM Plex Sans
- Creative/agency → Syne, Clash Display, Cabinet Grotesk
- Editorial/content → Playfair Display, Lora, Newsreader, DM Serif Display
- Lifestyle/wellness → DM Sans, Outfit, Plus Jakarta Sans
- Luxury/fashion → Cormorant Garamond, Bodoni Moda
- Playful/consumer → Nunito, Quicksand, Fredoka

Font weight creates hierarchy — don't use bold everywhere.
SIZE HIERARCHY (follow this exactly):
- Hero headline: text-5xl to text-7xl, font-light or font-normal, leading-[1.05], tracking-tight
- Section headings (h2): text-2xl to text-3xl max
- Card/feature titles (h3): text-lg max — use font-semibold for hierarchy, not bigger sizes
- Hero subtitle/tagline: text-base to text-lg max
- Body paragraphs & descriptions: text-sm or text-base ONLY. NEVER text-lg or larger for running text
- Card descriptions & feature text: text-sm
- Labels/meta: text-xs tracking-[0.15em] uppercase
The gap between headline and body should feel dramatic — that IS the hierarchy. Don't fill the gap with medium-sized text everywhere.

[Color — commit to a palette, not a rainbow]:
Pick a background strategy and commit:
- Light mode: warm off-whites (#faf9f6, #f7f5f2, #fefdfb) — NEVER use pure white (#ffffff)
- Dark mode: rich darks (#0a0a0a, #0f172a, #1a0a2e) — never generic gray (#1f2937)
Pick ONE accent color. Use it on exactly 2-3 elements (primary CTA, one highlight, maybe a subtle border). Everything else is the neutral palette. Two accent colors = amateur.

[Layout — break the grid, but with purpose]:
Avoid the "centered stack of sections" pattern. Real sites use tension:
- Hero: asymmetric split (text left, visual right) or full-bleed with text pinned to one edge
- Mix max-w-5xl centered sections with full-bleed sections
- At least one section should use asymmetric columns: grid-cols-[1.4fr_1fr] or grid-cols-[2fr_1fr]
- Vary section padding: py-16, py-24, py-32, py-40. Never the same twice in a row
- Left-align body text. Center-align only standalone headlines or CTAs

[Motion — subtle, not showy]:
Use GSAP + ScrollTrigger for scroll reveals, CSS transitions for hover states, and IntersectionObserver for simple appear-on-scroll effects. Less is more — not everything needs to animate.
For scroll reveals, use GSAP ScrollTrigger or vanilla IntersectionObserver:
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('animate-in'); });
}, { threshold: 0.1 });
document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));

[3D — only when it's THE concept]:
Three.js is available via CDN. ONLY use it when 3D IS the one visual concept — not as decoration on top of an already-busy design. Good: a single ambient particle field behind a minimal hero. Bad: particles + gradient text + badge chip + glassmorphism cards all in one page.

[Content — sound human]:
Write copy like a real person for this specific product. The tone must match: dev tools are direct and technical, wellness apps are warm and personal. NEVER use: "Welcome to," "Best-in-class," "Seamless," "Get Started," "Revolutionize," "Unlock the power of," "Your journey starts here." These are AI tells. Real copy is specific and surprising.

Page names (Home, About, Contact) are route names, NOT topics. A "Home" page is the homepage for the project, not about houses.

[Icons]: Use Lucide via CDN:
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
Then in body: <i data-lucide="icon-name"></i>
Then at end of body: <script>lucide.createIcons();</script>

[Images]: For photos, use https://picsum.photos/{width}/{height} as placeholder URLs. Write DESCRIPTIVE alt attributes that describe the intended image (e.g., alt="team collaborating at a whiteboard" not alt="image"). For avatars use https://i.pravatar.cc/{size}. CSS gradients and colored shapes are PREFERRED over placeholder photos — they look better and load faster. Only use images when the design concept truly calls for photography.

ANIMATION LIBRARIES — use via CDN as appropriate:
- GSAP: <script src="https://unpkg.com/gsap@3/dist/gsap.min.js"></script> and <script src="https://unpkg.com/gsap@3/dist/ScrollTrigger.min.js"></script>
- Three.js: <script src="https://unpkg.com/three@latest/build/three.module.js" type="module"></script>
- Vanta.js: <script src="https://unpkg.com/vanta@latest/dist/vanta.net.min.js"></script>
- tsParticles: <script src="https://cdn.jsdelivr.net/npm/tsparticles-slim@2/tsparticles.slim.bundle.min.js"></script>
- anime.js: <script src="https://unpkg.com/animejs@latest/lib/anime.min.js"></script>
- Lottie: <script src="https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js"></script>

Only include animation libraries if the user requests animations or the design calls for them. Don't add Three.js to a simple pricing page. DO use them for hero sections, landing pages, and when the user asks for something impressive.

GOOGLE FONTS — include in <head>:
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family={font}:wght@300;400;500;600;700&display=swap" rel="stylesheet">

STRUCTURE:
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- fonts, animation libraries as needed -->
</head>
<body>
  <!-- content with data-bf-id on every element -->
  <!-- scripts at end of body -->
</body>
</html>

[HARD RULES — violating these means the design is bad]:
1. ONE visual concept per page. If you used gradient text AND glassmorphism AND a badge chip AND a ticker bar AND grid-line backgrounds, you failed. Pick ONE or TWO max.
2. No dark navy gradient backgrounds (#0f172a → #1e293b) unless the archetype specifically calls for it. This is the #1 AI tell.
3. No generic "floating cards" scattered around the hero. This looks fake.
4. No badge chip above EVERY headline. Use it once per page or not at all.
5. Maximum 3 sections visible on the first page. Don't cram the entire site above the fold.
6. Body text is ALWAYS left-aligned. Never center long paragraphs.
7. Navigation should be minimal — 3-4 links max. No mega-menus.
8. CTA buttons need real, specific text. Not "Get Started" — say what actually happens: "Try free for 14 days," "See the demo," "Create your first project."
9. Don't put a number/stat in every section. One stat section per page max.
10. White space is a feature, not a bug. Sections with generous py-32 or py-40 and minimal content feel intentional and premium. Cramming content into every pixel feels cheap.
11. Body text, descriptions, and card content are NEVER larger than text-base (1rem/16px). The ONLY exception is a single hero subtitle which may be text-lg. If you used text-xl or text-2xl on a paragraph or description, you failed.
12. Card/feature titles max out at text-lg. Use font-semibold for hierarchy, not bigger sizes. Section headings (h2) max out at text-3xl. The hero headline is the ONLY text that gets to be huge.`;

const EDIT_DESIGN_PROMPT = `You are editing an existing design. Focus on iterative improvements while maintaining the existing design structure.

CRITICAL: Change as little as possible. Keep the original design structure, code, scripts, styles, fonts, colors, and layout as much as possible. Only change what is specifically requested by the user.

If the user's request is ambiguous, err on the side of minimal changes. Preserve all animations, typography choices, color palettes, and layout decisions unless explicitly asked to change them. If the existing design has oversized body text (text-lg, text-xl, or text-2xl on paragraphs or card descriptions), fix it — body text should be text-sm or text-base.

Return the COMPLETE updated HTML document (not just the changed parts). The output must be a full, working HTML page.`;

const ELEMENT_MODIFY_PROMPT = `You are modifying a selected HTML element based on user requests. Think through the changes needed, considering design consistency, accessibility, and best practices.

TASK: Modify the selected element based on the user's request and return ONLY the modified element with its EXACT data-bf-id preserved. Only output HTML with Tailwind classes. Any CSS styles should be in the style attribute. Make sure to always respect the structure and close tags properly. Use <i data-lucide="icon-name"></i> for icons.

Typography rules: Be precise with font weights, going one level lighter than standard. Titles over 20px get tight letter spacing. Avoid px or em for font sizing, minimum size is text-xs. Everything must be responsive. Content text (paragraphs, descriptions, card text) must be text-sm or text-base — never text-lg or larger. Only hero headlines get large sizes.`;

const ADD_SECTION_PROMPT = `You are adding new content after a selected element. Think through the design, structure, and integration with the existing layout.

TASK: Generate new HTML content to be inserted AFTER the specified element based on the user's request. Match the existing design's typography, colors, spacing, and animation patterns. The new section should feel like a natural extension of the existing design.

Use the same fonts, color palette, and animation patterns (GSAP, IntersectionObserver, CSS transitions) as the existing page. Maintain consistent spacing (py-24 or py-32 sections). Body paragraphs and descriptions must be text-sm or text-base. Card titles max at text-lg. Add data-bf-id to every element.`;

const CREATIVE_SEEDS = [
  "Make typography the ONLY visual element. No images, no icons, no decorative shapes. The entire design is type, color, and whitespace. Let the font do all the talking.",
  "Use ONE full-bleed hero image as the dominant visual. All other sections are text-only on clean backgrounds. The photo IS the design.",
  "Use an asymmetric two-column layout for EVERY section (grid-cols-[2fr_1fr] or grid-cols-[1fr_1.4fr]). Nothing centered. Everything offset. Asymmetry creates tension.",
  "The entire page uses ONLY black, white, and one accent color. No grays, no gradients. Three colors total. Constraint forces creativity.",
  "Make the hero just ONE sentence — text-6xl or larger, left-aligned, with 120px+ of padding around it. Then a single CTA below. Maximum impact through minimum content.",
  "Use a serif font for everything. Headlines, body, nav, buttons — all serif. Commit fully. This forces an editorial, literary feel that stands out from the sans-serif web.",
  "The entire page has a dark background (#0a0a0a). No light sections at all. All text is white or muted gray. Accent color appears on exactly 2 elements.",
  "Design around generous vertical rhythm — py-32 to py-48 on every section. The page should feel like it takes a deep breath between each section. Emptiness is the feature.",
  "Use a warm cream/paper background (#faf9f6) for the entire page with no dark sections. Everything is warm neutrals. The design feels handmade and human.",
  "Let the content layout tell a story — start with a single large statement, then reveal more detail section by section, building tension like a narrative. No random card grids.",
  "The hero has NO headline at all — just a product screenshot/visual filling 70%+ of the viewport with a small text caption below it. Show, don't tell.",
  "Use a monospace font (JetBrains Mono or IBM Plex Mono) as the primary font for everything. This creates a raw, technical, honest aesthetic.",
  "Design a split-screen hero: left half is a solid color with text, right half is a full-bleed image. The two halves create visual tension.",
  "Every section uses left-aligned text with a max-w-xl container — nothing wider. The right side of the page is intentionally empty. Restraint over filling space.",
  "Use a Three.js subtle particle field (200-400 small white points, slow drift) as the ONLY decorative element on the entire page. Everything else is clean typography on a dark bg. The particles are the personality.",
];

// ── Helper Functions ─────────────────────────────────────────────

/**
 * Pick N random creative seeds from the list.
 */
export function pickRandomSeeds(count: number = 2): string[] {
  const shuffled = [...CREATIVE_SEEDS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get layout/design guidance based on the page type.
 */
export function getPageTypeGuidance(pageType: string): string {
  const type = pageType.toUpperCase();
  switch (type) {
    case "LANDING":
      return `This is a marketing landing page. Focus on conversion — hero, social proof, benefits, and a strong closing CTA. Make the layout feel editorial, not templated.`;
    case "DASHBOARD":
      return `This is an application dashboard. Design a functional, data-rich interface with navigation, metrics, and content areas. This is NOT a marketing page — no hero sections, no CTAs. Think app UI, not website.`;
    case "FORM":
      return `This is a form page. Design a focused, distraction-free form experience with custom-styled inputs (never native browser elements), clear grouping, and validation states. Not a marketing page.`;
    case "LIST":
      return `This is a list/collection page. Design a browsable view with filtering, search, and well-structured item cards. Focus on information density and scannability. Not a marketing page.`;
    case "DETAIL":
      return `This is a detail page for viewing a single item. Design for comprehensive information display with clear hierarchy, metadata, actions, and related content. Not a marketing page.`;
    case "SETTINGS":
      return `This is a settings page. Design an organized preferences interface with grouped controls, custom toggles and inputs, and clear save actions. Not a marketing page.`;
    case "AUTH":
      return `This is an authentication page. Design a login/signup experience that feels trustworthy and minimal. Custom-styled form fields, not native browser inputs.`;
    case "CUSTOM":
    default:
      return `Analyze the page name and content to determine the right layout. Don't default to a marketing landing page — match the layout to the page's actual purpose.`;
  }
}

// ── Core AI Functions (Gemini) ───────────────────────────────────

interface GenerateDesignParams {
  projectName: string;
  projectDescription: string;
  pageName: string;
  pageType: string;
  sections: string[];
  styleGuideCode?: string;
  archetype?: string;
  components?: string[];
}

export async function generateDesign(
  params: GenerateDesignParams,
): Promise<string> {
  const {
    projectName,
    projectDescription,
    pageName,
    pageType,
    sections,
    styleGuideCode,
    archetype,
    components,
  } = params;

  const pageGuidance = getPageTypeGuidance(pageType);

  let styleTokenContext = "";
  if (styleGuideCode) {
    const tokens = extractStyleTokens(styleGuideCode);
    styleTokenContext = `\n\n${formatTokensForPrompt(tokens)}\n\nYou MUST match these tokens exactly. Use the same font, colors, spacing, and radius.`;
  }

  let archetypeDirective = "";
  if (archetype && archetype in DESIGN_ARCHETYPES) {
    const info = DESIGN_ARCHETYPES[archetype as keyof typeof DESIGN_ARCHETYPES];
    archetypeDirective = `\n\nDESIGN ARCHETYPE — ${info.label}:\n${info.promptDirective}`;
  }

  let creativeSeedContext = "";
  if (!styleGuideCode) {
    const seeds = pickRandomSeeds(2);
    creativeSeedContext = `\n\nCREATIVE DIRECTION — Pick ONE of these approaches (or ignore both and surprise me):\n${seeds.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
  }

  let componentsContext = "";
  if (components && components.length > 0) {
    componentsContext = `\n\nAVAILABLE COMPONENTS:\n${components.join("\n")}`;
  }

  const systemPrompt = `${DESIGN_SYSTEM_PROMPT}${archetypeDirective}${styleTokenContext}`;

  const userMessage = `Design a ${pageType} page for "${projectName}".

Project: ${projectDescription}
Page: "${pageName}" (${pageType})
${pageGuidance}

Sections to include: ${sections.join(", ")}
${creativeSeedContext}${componentsContext}

Remember: ONE visual concept. Make it award-winning. Output a complete HTML document.`;

  const temperature = styleGuideCode ? 0.7 : 0.95;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: 16384,
    },
  });

  const text = response.text ?? "";
  return extractHtmlFromResponse(text);
}

// ── Edit Design ──────────────────────────────────────────────────

interface EditDesignParams {
  projectName: string;
  projectDescription: string;
  pageName: string;
  pageType: string;
  previousHtml: string;
  editRequest: string;
  styleGuideCode?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function editDesign(params: EditDesignParams): Promise<string> {
  const {
    projectName,
    projectDescription,
    pageName,
    pageType,
    previousHtml,
    editRequest,
    styleGuideCode,
    conversationHistory,
  } = params;

  const pageGuidance = getPageTypeGuidance(pageType);

  let styleTokenContext = "";
  if (styleGuideCode) {
    const tokens = extractStyleTokens(styleGuideCode);
    styleTokenContext = `\n\n${formatTokensForPrompt(tokens)}\n\nMaintain consistency with these design tokens.`;
  }

  const systemPrompt = `${DESIGN_SYSTEM_PROMPT}\n\n${EDIT_DESIGN_PROMPT}${styleTokenContext}`;

  const contents: Array<{ role: "user" | "model"; parts: [{ text: string }] }> = [];

  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }

  contents.push({
    role: "user",
    parts: [
      {
        text: `Project: "${projectName}" — ${projectDescription}
Page: "${pageName}" (${pageType})
${pageGuidance}

Current design code:
\`\`\`html
${previousHtml}
\`\`\`

Edit request: ${editRequest}

Return the COMPLETE updated HTML document with ALL the changes applied. Do not omit any sections.`,
      },
    ],
  });

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.3,
      maxOutputTokens: 16384,
    },
  });

  const text = response.text ?? "";
  return extractHtmlFromResponse(text);
}

// ── Modify Element ───────────────────────────────────────────────

interface ModifyElementParams {
  elementHtml: string;
  elementId: string;
  elementTag: string;
  elementClasses: string;
  fullPageHtml: string;
  userRequest: string;
}

export async function modifyElement(
  params: ModifyElementParams,
): Promise<string> {
  const { elementHtml, elementId, elementTag, elementClasses, fullPageHtml, userRequest } = params;

  const userMessage = `Selected element:
- Tag: <${elementTag}>
- data-bf-id: ${elementId}
- Classes: ${elementClasses}
- Current HTML:
\`\`\`html
${elementHtml}
\`\`\`

Full page context (for reference only — do NOT return the full page):
\`\`\`html
${fullPageHtml}
\`\`\`

User request: ${userRequest}

Return ONLY the modified element HTML with its exact data-bf-id="${elementId}" preserved. Nothing else.`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    config: {
      systemInstruction: ELEMENT_MODIFY_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  });

  const text = response.text ?? "";
  return extractHtmlFromResponse(text);
}

// ── Add Section ──────────────────────────────────────────────────

interface AddSectionParams {
  projectName: string;
  pageName: string;
  afterElementHtml: string;
  afterElementTag: string;
  fullPageHtml: string;
  userRequest: string;
}

export async function addSection(params: AddSectionParams): Promise<string> {
  const { projectName, pageName, afterElementHtml, afterElementTag, fullPageHtml, userRequest } = params;

  const userMessage = `Project: "${projectName}"
Page: "${pageName}"

Insert new content AFTER this element:
- Tag: <${afterElementTag}>
- HTML:
\`\`\`html
${afterElementHtml}
\`\`\`

Full page context (for design matching — do NOT return the full page):
\`\`\`html
${fullPageHtml}
\`\`\`

User request: ${userRequest}

Return ONLY the new section HTML to be inserted. Add data-bf-id to every element. Match the existing design language exactly.`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    config: {
      systemInstruction: ADD_SECTION_PROMPT,
      temperature: 0.5,
      maxOutputTokens: 8192,
    },
  });

  const text = response.text ?? "";
  return extractHtmlFromResponse(text);
}

// ══════════════════════════════════════════════════════════════════
//  Streaming variants — return AsyncGenerator<{ text: string }>
// ══════════════════════════════════════════════════════════════════

export async function* editDesignStream(
  params: EditDesignParams,
): AsyncGenerator<{ text: string }> {
  const {
    projectName, projectDescription, pageName, pageType,
    previousHtml, editRequest, styleGuideCode, conversationHistory,
  } = params;

  const pageGuidance = getPageTypeGuidance(pageType);

  let styleTokenContext = "";
  if (styleGuideCode) {
    const tokens = extractStyleTokens(styleGuideCode);
    styleTokenContext = `\n\n${formatTokensForPrompt(tokens)}\n\nMaintain consistency with these design tokens.`;
  }

  const systemPrompt = `${DESIGN_SYSTEM_PROMPT}\n\n${EDIT_DESIGN_PROMPT}${styleTokenContext}`;

  const contents: Array<{ role: "user" | "model"; parts: [{ text: string }] }> = [];
  if (conversationHistory && conversationHistory.length > 0) {
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }
  }
  contents.push({
    role: "user",
    parts: [{
      text: `Project: "${projectName}" — ${projectDescription}
Page: "${pageName}" (${pageType})
${pageGuidance}

Current design code:
\`\`\`html
${previousHtml}
\`\`\`

Edit request: ${editRequest}

Return the COMPLETE updated HTML document with ALL the changes applied. Do not omit any sections.`,
    }],
  });

  const response = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents,
    config: {
      systemInstruction: systemPrompt,
      temperature: 0.3,
      maxOutputTokens: 16384,
    },
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) yield { text };
  }
}

export async function* modifyElementStream(
  params: ModifyElementParams,
): AsyncGenerator<{ text: string }> {
  const { elementHtml, elementId, elementTag, elementClasses, fullPageHtml, userRequest } = params;

  const userMessage = `Selected element:
- Tag: <${elementTag}>
- data-bf-id: ${elementId}
- Classes: ${elementClasses}
- Current HTML:
\`\`\`html
${elementHtml}
\`\`\`

Full page context (for reference only — do NOT return the full page):
\`\`\`html
${fullPageHtml}
\`\`\`

User request: ${userRequest}

Return ONLY the modified element HTML with its exact data-bf-id="${elementId}" preserved. Nothing else.`;

  const response = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    config: {
      systemInstruction: ELEMENT_MODIFY_PROMPT,
      temperature: 0.3,
      maxOutputTokens: 8192,
    },
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) yield { text };
  }
}

export async function* addSectionStream(
  params: AddSectionParams,
): AsyncGenerator<{ text: string }> {
  const { projectName, pageName, afterElementHtml, afterElementTag, fullPageHtml, userRequest } = params;

  const userMessage = `Project: "${projectName}"
Page: "${pageName}"

Insert new content AFTER this element:
- Tag: <${afterElementTag}>
- HTML:
\`\`\`html
${afterElementHtml}
\`\`\`

Full page context (for design matching — do NOT return the full page):
\`\`\`html
${fullPageHtml}
\`\`\`

User request: ${userRequest}

Return ONLY the new section HTML to be inserted. Add data-bf-id to every element. Match the existing design language exactly.`;

  const response = await ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: [{ role: "user", parts: [{ text: userMessage }] }],
    config: {
      systemInstruction: ADD_SECTION_PROMPT,
      temperature: 0.5,
      maxOutputTokens: 8192,
    },
  });

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) yield { text };
  }
}
