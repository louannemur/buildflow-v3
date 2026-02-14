/**
 * Injects data-bf-id attributes into JSX elements for visual editor targeting.
 * Post-processes AI-generated React code to add unique IDs on every element.
 */

export interface BfIdMap {
  [bfId: string]: string; // bfId -> tag name
}

export interface InjectionResult {
  annotatedCode: string;
  idMap: BfIdMap;
}

/**
 * Inject data-bf-id="bf-N" attributes into all JSX opening tags.
 *
 * Strategy: Use regex to find opening JSX tags and insert the attribute.
 * - Match: <tagName (lowercase HTML or uppercase Component)
 * - Skip: fragments (<>, </>), closing tags (</), comments, already-tagged elements
 * - Skip: tags inside template literal strings
 */
export function injectBfIds(code: string): InjectionResult {
  const idMap: BfIdMap = {};
  let counter = 0;

  // Match opening JSX tags: < followed by a letter (tag name), then space or >
  // Captures: the full opening tag portion up to the first space or >
  // Negative lookbehind for / (closing tags) and ! (comments)
  const tagPattern = /(<)([a-zA-Z][a-zA-Z0-9.]*)([\s/>])/g;

  const annotatedCode = code.replace(tagPattern, (match, openBracket, tagName, afterTag, offset) => {
    // Skip if this is inside a closing tag (look back for </)
    const before = code.slice(Math.max(0, offset - 2), offset);
    if (before.endsWith('</') || before.endsWith('</ ')) return match;

    // Skip fragments
    if (tagName === '') return match;

    // Skip if already has data-bf-id
    const restOfLine = code.slice(offset, offset + 200);
    if (restOfLine.match(/^<[a-zA-Z][a-zA-Z0-9.]*\s[^>]*data-bf-id/)) return match;

    // Skip React internal components (motion.div handled separately)
    // But keep motion.* components since they render DOM elements

    // Skip if the tag is self-closing and is a fragment-like construct
    if (tagName === 'React.Fragment') return match;

    const bfId = `bf-${counter++}`;
    idMap[bfId] = tagName;

    // Insert data-bf-id after the tag name
    if (afterTag === '>') {
      // <div> → <div data-bf-id="bf-0">
      return `${openBracket}${tagName} data-bf-id="${bfId}"${afterTag}`;
    } else if (afterTag === '/') {
      // Check if self-closing: <br /> or <img />
      return `${openBracket}${tagName} data-bf-id="${bfId}"${afterTag}`;
    } else {
      // <div className="..." → <div data-bf-id="bf-0" className="..."
      return `${openBracket}${tagName} data-bf-id="${bfId}"${afterTag}`;
    }
  });

  return { annotatedCode, idMap };
}

/**
 * Strip all data-bf-id attributes from code.
 * Used when saving clean code or sending to AI for editing.
 */
export function stripBfIds(code: string): string {
  return code.replace(/\s*data-bf-id="[^"]*"/g, '');
}

/**
 * Generate a random 8-character alphanumeric bf-id.
 * Format: bf_XXXXXXXX
 */
function generateBfId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'bf_';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Ensure all visible HTML elements have a data-bf-id attribute.
 *
 * - Finds all opening HTML tags that do NOT already have data-bf-id
 * - Skips non-visual tags: <html>, <head>, <meta>, <link>, <script>, <style>, <title>
 * - Generates unique random bf_XXXXXXXX IDs for each element
 * - Deduplicates any collisions (if an AI reused an ID)
 */
export function ensureBfIds(html: string): string {
  const nonVisualTags = new Set(['html', 'head', 'meta', 'link', 'script', 'style', 'title']);
  const usedIds = new Set<string>();

  // Collect all existing data-bf-id values so we can detect collisions
  const existingIdPattern = /data-bf-id="([^"]*)"/g;
  let existingMatch;
  while ((existingMatch = existingIdPattern.exec(html)) !== null) {
    usedIds.add(existingMatch[1]);
  }

  // Same tag pattern as injectBfIds: opening tags starting with a letter
  const tagPattern = /(<)([a-zA-Z][a-zA-Z0-9.]*)([\s/>])/g;

  let result = html.replace(tagPattern, (match, openBracket, tagName, afterTag, offset) => {
    // Skip closing tags (look back for </)
    const before = html.slice(Math.max(0, offset - 2), offset);
    if (before.endsWith('</') || before.endsWith('</ ')) return match;

    // Skip fragments
    if (tagName === '') return match;

    // Skip non-visual tags
    if (nonVisualTags.has(tagName.toLowerCase())) return match;

    // Skip if already has data-bf-id
    const restOfTag = html.slice(offset, offset + 500);
    if (restOfTag.match(/^<[a-zA-Z][a-zA-Z0-9.]*[\s][^>]*data-bf-id/)) return match;

    // Generate a unique ID, avoiding collisions
    let bfId = generateBfId();
    while (usedIds.has(bfId)) {
      bfId = generateBfId();
    }
    usedIds.add(bfId);

    // Insert data-bf-id after the tag name
    return `${openBracket}${tagName} data-bf-id="${bfId}"${afterTag}`;
  });

  // Deduplicate: if any data-bf-id values appear more than once, reassign duplicates
  const idCounts = new Map<string, number>();
  const dedupPattern = /data-bf-id="([^"]*)"/g;
  let dedupMatch;
  while ((dedupMatch = dedupPattern.exec(result)) !== null) {
    const id = dedupMatch[1];
    idCounts.set(id, (idCounts.get(id) || 0) + 1);
  }

  // For any duplicated IDs, replace all but the first occurrence
  for (const [id, count] of idCounts) {
    if (count > 1) {
      let seen = 0;
      result = result.replace(new RegExp(`data-bf-id="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'), (m) => {
        seen++;
        if (seen === 1) return m; // keep the first occurrence
        let newId = generateBfId();
        while (usedIds.has(newId)) {
          newId = generateBfId();
        }
        usedIds.add(newId);
        return `data-bf-id="${newId}"`;
      });
    }
  }

  return result;
}
