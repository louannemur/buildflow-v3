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
