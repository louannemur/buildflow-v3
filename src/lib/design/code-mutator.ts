/**
 * Code mutator — surgically modifies React/JSX code strings based on data-bf-id attributes.
 * Used by the visual editor to update elements without full AI regeneration.
 */

export interface ElementLocation {
  /** Start index of the opening < bracket */
  start: number;
  /** End index (exclusive) — after the closing tag's > or self-closing /> */
  end: number;
  /** The full outer JSX string of the element */
  outerJsx: string;
  /** The tag name (e.g., 'div', 'section', 'motion.div') */
  tag: string;
  /** The className value (empty string if none) */
  classes: string;
  /** Whether the element is self-closing */
  selfClosing: boolean;
}

/**
 * Find the JSX element with the given data-bf-id in the code string.
 * Returns position info and extracted data, or null if not found.
 */
export function findElementInCode(code: string, bfId: string): ElementLocation | null {
  // Find the data-bf-id attribute
  const attrPattern = new RegExp(`data-bf-id="${escapeRegex(bfId)}"`);
  const attrMatch = attrPattern.exec(code);
  if (!attrMatch) return null;

  const attrIndex = attrMatch.index;

  // Walk backwards to find the opening < of this tag
  let openBracket = attrIndex;
  while (openBracket > 0 && code[openBracket] !== '<') {
    openBracket--;
  }

  // Extract the tag name
  const tagMatch = code.slice(openBracket).match(/^<([a-zA-Z][a-zA-Z0-9.]*)/);
  if (!tagMatch) return null;
  const tag = tagMatch[1];

  // First, find the end of the opening tag (handle attributes with nested braces, strings, etc.)
  const i = findOpeningTagEnd(code, openBracket);
  if (i === -1) return null;

  const openingTagContent = code.slice(openBracket, i + 1);
  const selfClosing = openingTagContent.endsWith('/>');

  // Extract className
  const classes = extractClassName(openingTagContent);

  if (selfClosing) {
    const outerJsx = code.slice(openBracket, i + 1);
    return { start: openBracket, end: i + 1, outerJsx, tag, classes, selfClosing: true };
  }

  // Not self-closing — find the matching closing tag
  const closingEnd = findMatchingClose(code, i + 1, tag);
  if (closingEnd === -1) {
    // Fallback: just return the opening tag
    return { start: openBracket, end: i + 1, outerJsx: openingTagContent, tag, classes, selfClosing: false };
  }

  const outerJsx = code.slice(openBracket, closingEnd);
  return { start: openBracket, end: closingEnd, outerJsx, tag, classes, selfClosing: false };
}

/**
 * Find the end of an opening tag, handling nested braces, strings, and template literals.
 * Returns the index of the closing > or /> character.
 */
function findOpeningTagEnd(code: string, openBracket: number): number {
  let i = openBracket + 1;
  const len = code.length;

  // Skip tag name
  while (i < len && /[a-zA-Z0-9.]/.test(code[i])) i++;

  // Now scan through attributes
  while (i < len) {
    const ch = code[i];

    if (ch === '>') return i;
    if (ch === '/' && i + 1 < len && code[i + 1] === '>') return i + 1;

    // Skip string literals in attributes
    if (ch === '"' || ch === "'") {
      i = skipString(code, i);
      continue;
    }

    // Skip JSX expression containers { ... }
    if (ch === '{') {
      i = skipBraceBlock(code, i);
      continue;
    }

    i++;
  }

  return -1;
}

/**
 * Find the matching closing tag for an element.
 * Handles nested elements with the same tag name.
 */
function findMatchingClose(code: string, startAfterOpen: number, tag: string): number {
  let i = startAfterOpen;
  const len = code.length;
  let depth = 1;

  while (i < len && depth > 0) {
    // Skip non-tag characters quickly
    if (code[i] !== '<') {
      // Skip JSX expression containers
      if (code[i] === '{') {
        i = skipJsxExpression(code, i);
        continue;
      }
      i++;
      continue;
    }

    // We found a '<'
    // Check for closing tag
    if (code[i + 1] === '/') {
      const closeMatch = code.slice(i).match(/^<\/([a-zA-Z][a-zA-Z0-9.]*)\s*>/);
      if (closeMatch) {
        if (closeMatch[1] === tag) {
          depth--;
          if (depth === 0) {
            return i + closeMatch[0].length;
          }
        }
        i += closeMatch[0].length;
        continue;
      }
    }

    // Check for opening tag (same tag name — increases depth)
    const openMatch = code.slice(i).match(/^<([a-zA-Z][a-zA-Z0-9.]*)/);
    if (openMatch) {
      const matchedTag = openMatch[1];

      // Find the end of this opening tag
      const tagEnd = findOpeningTagEnd(code, i);
      if (tagEnd === -1) {
        i++;
        continue;
      }

      const tagContent = code.slice(i, tagEnd + 1);
      const isSelfClose = tagContent.endsWith('/>');

      if (matchedTag === tag && !isSelfClose) {
        depth++;
      }

      i = tagEnd + 1;
      continue;
    }

    // Fragment or other
    i++;
  }

  return depth === 0 ? i : -1;
}

/**
 * Skip a string literal starting at position i.
 * Returns the index after the closing quote.
 */
function skipString(code: string, i: number): number {
  const quote = code[i];
  i++;
  while (i < code.length) {
    if (code[i] === '\\') {
      i += 2;
      continue;
    }
    if (code[i] === quote) return i + 1;
    i++;
  }
  return i;
}

/**
 * Skip a brace-delimited block { ... }, handling nested braces, strings, and template literals.
 * Returns the index after the closing }.
 */
function skipBraceBlock(code: string, start: number): number {
  let depth = 0;
  let i = start;
  const len = code.length;

  while (i < len) {
    const ch = code[i];

    if (ch === '{') {
      depth++;
      i++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) return i + 1;
      i++;
    } else if (ch === '"' || ch === "'" || ch === '`') {
      i = skipStringOrTemplate(code, i);
    } else {
      i++;
    }
  }

  return i;
}

/**
 * Skip a JSX expression container { ... }, handling nested content including JSX.
 */
function skipJsxExpression(code: string, start: number): number {
  return skipBraceBlock(code, start);
}

/**
 * Skip a string or template literal.
 */
function skipStringOrTemplate(code: string, i: number): number {
  const ch = code[i];

  if (ch === '`') {
    // Template literal — handle ${...} expressions
    i++;
    while (i < code.length) {
      if (code[i] === '\\') {
        i += 2;
        continue;
      }
      if (code[i] === '$' && i + 1 < code.length && code[i + 1] === '{') {
        i = skipBraceBlock(code, i + 1);
        continue;
      }
      if (code[i] === '`') return i + 1;
      i++;
    }
    return i;
  }

  return skipString(code, i);
}

/**
 * Extract the className value from an opening tag string.
 */
function extractClassName(openingTag: string): string {
  // HTML: class="..."
  const htmlClassMatch = openingTag.match(/\bclass\s*=\s*"([^"]*)"/);
  if (htmlClassMatch) return htmlClassMatch[1];

  const htmlClassSingleMatch = openingTag.match(/\bclass\s*=\s*'([^']*)'/);
  if (htmlClassSingleMatch) return htmlClassSingleMatch[1];

  // Match className="..." or className='...'
  const staticMatch = openingTag.match(/className\s*=\s*"([^"]*)"/);
  if (staticMatch) return staticMatch[1];

  const singleQuoteMatch = openingTag.match(/className\s*=\s*'([^']*)'/);
  if (singleQuoteMatch) return singleQuoteMatch[1];

  // Match className={`...`} (template literal — extract just the static parts)
  const templateMatch = openingTag.match(/className\s*=\s*\{`([^`]*)`\}/);
  if (templateMatch) return templateMatch[1];

  // Match className={"..."} or className={'...'}
  const exprStringMatch = openingTag.match(/className\s*=\s*\{"([^"]*)"\}/);
  if (exprStringMatch) return exprStringMatch[1];

  return '';
}

/**
 * Update an element's className value in the code.
 * Handles className="...", className={'...'}, and className={`...`} patterns.
 */
export function updateElementClasses(code: string, bfId: string, newClasses: string): string {
  const loc = findElementInCode(code, bfId);
  if (!loc) return code;

  const openingTag = getOpeningTag(code, loc.start);
  if (!openingTag) return code;

  const { content: tagContent, end: tagEnd } = openingTag;

  // Try to replace existing className
  let newTag = tagContent;
  let replaced = false;

  // className="..."
  newTag = tagContent.replace(/className\s*=\s*"[^"]*"/, () => {
    replaced = true;
    return `className="${newClasses}"`;
  });

  if (!replaced) {
    // className={'...'}
    newTag = tagContent.replace(/className\s*=\s*\{'[^']*'\}/, () => {
      replaced = true;
      return `className="${newClasses}"`;
    });
  }

  if (!replaced) {
    // className={`...`}
    newTag = tagContent.replace(/className\s*=\s*\{`[^`]*`\}/, () => {
      replaced = true;
      return `className="${newClasses}"`;
    });
  }

  if (!replaced) {
    // className={"..."}
    newTag = tagContent.replace(/className\s*=\s*\{"[^"]*"\}/, () => {
      replaced = true;
      return `className="${newClasses}"`;
    });
  }

  if (!replaced) {
    // HTML class="..."
    newTag = tagContent.replace(/\bclass\s*=\s*"[^"]*"/, () => {
      replaced = true;
      return `class="${newClasses}"`;
    });
  }

  if (!replaced) {
    // HTML class='...'
    newTag = tagContent.replace(/\bclass\s*=\s*'[^']*'/, () => {
      replaced = true;
      return `class="${newClasses}"`;
    });
  }

  if (!replaced) {
    // No class attribute exists — add one after data-bf-id
    const isHtml = !tagContent.includes('className=');
    const attrName = isHtml ? 'class' : 'className';
    newTag = tagContent.replace(
      `data-bf-id="${bfId}"`,
      `data-bf-id="${bfId}" ${attrName}="${newClasses}"`
    );
    replaced = true;
  }

  if (!replaced) return code;

  return code.slice(0, loc.start) + newTag + code.slice(tagEnd);
}

/**
 * Update an element's direct text content.
 * Handles both simple text elements and elements with mixed content
 * (text nodes + child elements) by doing targeted replacement.
 *
 * @param oldText - Optional: the current text to find and replace (for mixed content).
 *                  When provided, enables targeted replacement even in elements with children.
 */
export function updateElementText(code: string, bfId: string, newText: string, oldText?: string): string {
  const loc = findElementInCode(code, bfId);
  if (!loc || loc.selfClosing) return code;

  const openingTag = getOpeningTag(code, loc.start);
  if (!openingTag) return code;

  const contentStart = openingTag.end;
  const closingTagStart = loc.end - `</${loc.tag}>`.length;

  const content = code.slice(contentStart, closingTagStart);

  // Check if the content is just text (no < characters except in expressions)
  const strippedContent = content.replace(/\{[^}]*\}/g, '');
  if (!strippedContent.includes('<')) {
    // Simple text only — replace all content
    return code.slice(0, contentStart) + newText + code.slice(closingTagStart);
  }

  // Has nested elements — try targeted replacement if oldText is provided
  if (oldText && content.includes(oldText)) {
    const newContent = content.replace(oldText, newText);
    return code.slice(0, contentStart) + newContent + code.slice(closingTagStart);
  }

  return code;
}

/**
 * Replace an entire element's JSX with new JSX.
 */
export function replaceElement(code: string, bfId: string, newJsx: string): string {
  const loc = findElementInCode(code, bfId);
  if (!loc) return code;

  return code.slice(0, loc.start) + newJsx + code.slice(loc.end);
}

/**
 * Insert JSX after an element (as a sibling).
 */
export function insertAfterElement(code: string, bfId: string, newJsx: string): string {
  const loc = findElementInCode(code, bfId);
  if (!loc) return code;

  // Determine proper indentation from the element's position
  const lineStart = code.lastIndexOf('\n', loc.start) + 1;
  const indent = code.slice(lineStart, loc.start).match(/^\s*/)?.[0] || '';

  return code.slice(0, loc.end) + '\n' + indent + newJsx + code.slice(loc.end);
}

/**
 * Remove an element from the code.
 */
export function removeElement(code: string, bfId: string): string {
  const loc = findElementInCode(code, bfId);
  if (!loc) return code;

  // Also remove the preceding whitespace/newline if it's on its own line
  let removeStart = loc.start;
  const lineStart = code.lastIndexOf('\n', loc.start - 1);
  if (lineStart !== -1) {
    const prefix = code.slice(lineStart + 1, loc.start);
    if (/^\s*$/.test(prefix)) {
      removeStart = lineStart + 1;
    }
  }

  // Also remove the trailing newline if present
  let removeEnd = loc.end;
  if (code[removeEnd] === '\n') {
    removeEnd++;
  }

  return code.slice(0, removeStart) + code.slice(removeEnd);
}

/**
 * Add a single class to an element's className.
 */
export function addClassToElement(code: string, bfId: string, newClass: string): string {
  const loc = findElementInCode(code, bfId);
  if (!loc) return code;

  const currentClasses = loc.classes;
  const classSet = new Set(currentClasses.split(/\s+/).filter(Boolean));

  // Don't add duplicates
  if (classSet.has(newClass)) return code;

  const updatedClasses = currentClasses ? `${currentClasses} ${newClass}` : newClass;
  return updateElementClasses(code, bfId, updatedClasses);
}

/**
 * Remove a single class from an element's className.
 */
export function removeClassFromElement(code: string, bfId: string, classToRemove: string): string {
  const loc = findElementInCode(code, bfId);
  if (!loc) return code;

  const classes = loc.classes.split(/\s+/).filter(Boolean);
  const filtered = classes.filter(c => c !== classToRemove);
  return updateElementClasses(code, bfId, filtered.join(' '));
}

/**
 * Get the opening tag content and end position for an element.
 */
export function getOpeningTag(code: string, start: number): { content: string; end: number } | null {
  const end = findOpeningTagEnd(code, start);
  if (end === -1) return null;
  return { content: code.slice(start, end + 1), end: end + 1 };
}

/**
 * Update (or add) an attribute on an element identified by its bf-id.
 * Works for any attribute (src, alt, href, etc.).
 *
 * Handles patterns:
 *   attrName="value"
 *   attrName={"value"}
 *
 * Skips attrName={variable} (cannot safely replace a variable reference).
 * If the attribute doesn't exist, inserts it after the data-bf-id attribute.
 */
export function updateElementAttribute(
  code: string,
  bfId: string,
  attrName: string,
  newValue: string,
): string {
  const loc = findElementInCode(code, bfId);
  if (!loc) return code;

  const tag = getOpeningTag(code, loc.start);
  if (!tag) return code;

  const opening = tag.content;
  const escapedAttr = escapeRegex(attrName);

  // Try to replace existing attribute: attrName="..."
  const doubleQuoteRe = new RegExp(`(${escapedAttr}\\s*=\\s*)"([^"]*)"`);
  if (doubleQuoteRe.test(opening)) {
    const updated = opening.replace(doubleQuoteRe, `$1"${newValue}"`);
    return code.slice(0, loc.start) + updated + code.slice(loc.start + opening.length);
  }

  // Try: attrName={"..."}
  const exprStringRe = new RegExp(`(${escapedAttr}\\s*=\\s*)\\{"([^"]*)"\\}`);
  if (exprStringRe.test(opening)) {
    const updated = opening.replace(exprStringRe, `$1"${newValue}"`);
    return code.slice(0, loc.start) + updated + code.slice(loc.start + opening.length);
  }

  // Try: attrName={'...'}
  const exprSingleRe = new RegExp(`(${escapedAttr}\\s*=\\s*)\\{'([^']*)'\\}`);
  if (exprSingleRe.test(opening)) {
    const updated = opening.replace(exprSingleRe, `$1"${newValue}"`);
    return code.slice(0, loc.start) + updated + code.slice(loc.start + opening.length);
  }

  // Try: attrName={`...`}
  const exprTemplateRe = new RegExp(`(${escapedAttr}\\s*=\\s*)\\{\`[^\`]*\`\\}`);
  if (exprTemplateRe.test(opening)) {
    const updated = opening.replace(exprTemplateRe, `$1"${newValue}"`);
    return code.slice(0, loc.start) + updated + code.slice(loc.start + opening.length);
  }

  // Check for variable reference: attrName={variable} — skip, can't safely replace
  const varRefRe = new RegExp(`${escapedAttr}\\s*=\\s*\\{[^"'\`}]+\\}`);
  if (varRefRe.test(opening)) {
    return code; // Leave as-is
  }

  // Attribute doesn't exist — insert after data-bf-id="..."
  const bfIdAttr = `data-bf-id="${bfId}"`;
  const insertPos = opening.indexOf(bfIdAttr);
  if (insertPos !== -1) {
    const insertAt = loc.start + insertPos + bfIdAttr.length;
    const insertion = ` ${attrName}="${newValue}"`;
    return code.slice(0, insertAt) + insertion + code.slice(insertAt);
  }

  // Last resort: insert before the closing > or />
  const closingIdx = opening.endsWith('/>') ? opening.length - 2 : opening.length - 1;
  const insertAt2 = loc.start + closingIdx;
  const insertion2 = ` ${attrName}="${newValue}" `;
  return code.slice(0, insertAt2) + insertion2 + code.slice(insertAt2);
}

/**
 * Move an element to a new position relative to a target sibling element.
 * Removes the element from its current position and inserts it before/after the target.
 * Only works for elements within the same parent (siblings).
 */
export function moveElement(
  code: string,
  bfId: string,
  targetBfId: string,
  position: 'before' | 'after',
): string {
  if (bfId === targetBfId) return code;

  const loc = findElementInCode(code, bfId);
  if (!loc) return code;

  const elementJsx = loc.outerJsx;

  // Remove the element from the code
  const codeWithout = removeElement(code, bfId);

  // Find the target in the modified code
  const targetLoc = findElementInCode(codeWithout, targetBfId);
  if (!targetLoc) return code; // Fallback to original

  // Determine indentation from the target element
  const lineStart = codeWithout.lastIndexOf('\n', targetLoc.start) + 1;
  const indent = codeWithout.slice(lineStart, targetLoc.start).match(/^\s*/)?.[0] || '';

  if (position === 'before') {
    return codeWithout.slice(0, targetLoc.start) + elementJsx + '\n' + indent + codeWithout.slice(targetLoc.start);
  } else {
    return codeWithout.slice(0, targetLoc.end) + '\n' + indent + elementJsx + codeWithout.slice(targetLoc.end);
  }
}

/**
 * Find the bf-ids of the previous and next sibling elements in the HTML code.
 * Siblings are determined by finding elements at the same nesting level
 * within the same parent block — not from the element tree (which can skip
 * non-bf-id wrapper elements and produce incorrect sibling relationships).
 */
export function findCodeSiblings(code: string, bfId: string): {
  prevBfId: string | null;
  nextBfId: string | null;
} {
  const loc = findElementInCode(code, bfId);
  if (!loc) return { prevBfId: null, nextBfId: null };

  // Determine the indentation of this element to find same-level siblings
  const lineStart = code.lastIndexOf('\n', loc.start) + 1;
  const indent = code.slice(lineStart, loc.start).match(/^\s*/)?.[0] || '';

  // Find the parent block boundaries by looking for the enclosing tag
  // Walk backwards from our element to find where the parent's content starts
  let parentContentStart = 0;
  let parentContentEnd = code.length;

  // Walk backwards to find the parent opening tag's end (the > before our content area)
  let depth = 0;
  for (let i = loc.start - 1; i >= 0; i--) {
    const ch = code[i];
    if (ch === '>' && i > 0 && code[i - 1] !== '-') {
      // Check if this closes an opening tag (not a closing tag like </div>)
      // Walk back to find if this is </tag> or <tag>
      let j = i - 1;
      while (j >= 0 && code[j] !== '<') j--;
      if (j >= 0) {
        if (code[j + 1] === '/') {
          depth++;
        } else {
          if (depth > 0) {
            depth--;
          } else {
            parentContentStart = i + 1;
            break;
          }
        }
      }
    }
  }

  // Walk forward from end of our element to find the parent closing tag
  depth = 0;
  for (let i = loc.end; i < code.length; i++) {
    if (code[i] === '<') {
      if (code[i + 1] === '/') {
        if (depth === 0) {
          parentContentEnd = i;
          break;
        }
        depth--;
      } else if (code[i] === '<' && code.slice(i).match(/^<[a-zA-Z]/)) {
        // Opening tag — find its end
        const endIdx = findOpeningTagEnd(code, i);
        if (endIdx !== -1) {
          const tagStr = code.slice(i, endIdx + 1);
          if (!tagStr.endsWith('/>')) {
            depth++;
          }
          i = endIdx;
        }
      }
    }
  }

  // Scan the parent content area for all bf-id elements at the same indent level
  const bfIdPattern = /data-bf-id="(bf_[a-zA-Z0-9]+)"/g;
  const siblingBfIds: string[] = [];
  const contentArea = code.slice(parentContentStart, parentContentEnd);

  let match;
  while ((match = bfIdPattern.exec(contentArea)) !== null) {
    const foundBfId = match[1];
    const absPos = parentContentStart + match.index;

    // Check that this element is at the same indentation level
    const foundLineStart = code.lastIndexOf('\n', absPos) + 1;
    // Walk back to the opening < of this element
    let openBracket = absPos;
    while (openBracket > foundLineStart && code[openBracket] !== '<') openBracket--;

    const foundIndent = code.slice(foundLineStart, openBracket).match(/^\s*/)?.[0] || '';
    if (foundIndent === indent) {
      siblingBfIds.push(foundBfId);
    }
  }

  const idx = siblingBfIds.indexOf(bfId);
  return {
    prevBfId: idx > 0 ? siblingBfIds[idx - 1] : null,
    nextBfId: idx >= 0 && idx < siblingBfIds.length - 1 ? siblingBfIds[idx + 1] : null,
  };
}

/**
 * Set a CSS property on an element's inline style attribute.
 * Creates the style attribute if it doesn't exist, or merges with existing styles.
 */
export function setInlineStyleProperty(
  code: string,
  bfId: string,
  property: string,
  value: string,
): string {
  const loc = findElementInCode(code, bfId);
  if (!loc) return code;

  const tag = getOpeningTag(code, loc.start);
  if (!tag) return code;

  const opening = tag.content;

  // Check if element already has a style attribute
  const styleMatch = opening.match(/\bstyle\s*=\s*"([^"]*)"/);
  if (styleMatch) {
    const currentStyle = styleMatch[1];
    // Replace existing property or append
    const propRegex = new RegExp(
      `(^|;\\s*)${escapeRegex(property)}\\s*:[^;]*(;|$)`
    );
    let newStyle: string;
    if (propRegex.test(currentStyle)) {
      newStyle = currentStyle.replace(propRegex, `$1${property}: ${value};`);
    } else {
      const sep = currentStyle && !currentStyle.trimEnd().endsWith(';') ? '; ' : ' ';
      newStyle = currentStyle
        ? `${currentStyle}${sep}${property}: ${value};`
        : `${property}: ${value};`;
    }
    const updated = opening.replace(
      /\bstyle\s*=\s*"[^"]*"/,
      `style="${newStyle.trim()}"`
    );
    return code.slice(0, loc.start) + updated + code.slice(tag.end);
  }

  // No style attribute — insert after data-bf-id
  const bfIdAttr = `data-bf-id="${bfId}"`;
  const bfIdPos = opening.indexOf(bfIdAttr);
  if (bfIdPos !== -1) {
    const insertAt = loc.start + bfIdPos + bfIdAttr.length;
    return code.slice(0, insertAt) + ` style="${property}: ${value};"` + code.slice(insertAt);
  }

  return code;
}

/**
 * Escape special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
