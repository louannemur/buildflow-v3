/**
 * Extract code from an AI response that may contain markdown code blocks.
 * Shared between server (design.ts) and client (useAIGenerate.ts).
 */

/** Extract JSX/TSX code from AI response (legacy, for non-design features) */
export function extractCodeFromResponse(text: string): string {
  const codeBlockMatch = text.match(
    /```(?:jsx|tsx|javascript|typescript|react)?\s*\n([\s\S]*?)```/
  );
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  const trimmed = text.trim();
  if (
    trimmed.startsWith("'use client'") ||
    trimmed.startsWith('"use client"') ||
    trimmed.startsWith("import ")
  ) {
    return trimmed;
  }

  return trimmed;
}

/** Case-insensitive indexOf helper */
function indexOfCI(text: string, search: string): number {
  return text.toLowerCase().indexOf(search.toLowerCase());
}

/** Extract HTML from AI response — looks for html code blocks or raw HTML documents */
export function extractHtmlFromResponse(text: string): string {
  // Try ```html code block first
  const htmlBlockMatch = text.match(
    /```(?:html)?\s*\n([\s\S]*?)```/
  );
  if (htmlBlockMatch) {
    const inner = htmlBlockMatch[1].trim();
    if (indexOfCI(inner, '<!doctype') !== -1 || indexOfCI(inner, '<html') !== -1) {
      return inner;
    }
    // Could be a partial HTML snippet (for element/section responses)
    return inner;
  }

  // Try to find raw HTML document in the text (case-insensitive)
  const doctypeIndex = indexOfCI(text, '<!doctype');
  const htmlTagIndex = indexOfCI(text, '<html');
  const htmlStart = doctypeIndex !== -1 ? doctypeIndex : htmlTagIndex;

  if (htmlStart !== -1) {
    const htmlEnd = indexOfCI(text, '</html>');
    if (htmlEnd !== -1) {
      return text.slice(htmlStart, htmlEnd + '</html>'.length);
    }
    // No closing tag yet, return from start
    return text.slice(htmlStart);
  }

  // For partial responses (element modifications, sections), return trimmed text
  return text.trim();
}

/** Streaming HTML extractor — detects when HTML starts and whether it's complete */
export function extractHtmlFromStream(accumulated: string): {
  htmlStarted: boolean;
  htmlContent: string;
  isComplete: boolean;
} {
  const doctypeIndex = indexOfCI(accumulated, '<!doctype');
  const htmlTagIndex = indexOfCI(accumulated, '<html');
  const htmlStart = doctypeIndex !== -1 ? doctypeIndex : htmlTagIndex;

  if (htmlStart === -1) {
    return { htmlStarted: false, htmlContent: '', isComplete: false };
  }

  const htmlContent = accumulated.slice(htmlStart);
  const isComplete = indexOfCI(htmlContent, '</html>') !== -1;

  return { htmlStarted: true, htmlContent, isComplete };
}
