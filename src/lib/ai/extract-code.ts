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

/** Extract HTML from AI response — looks for html code blocks or raw HTML documents */
export function extractHtmlFromResponse(text: string): string {
  // Try ```html code block first
  const htmlBlockMatch = text.match(
    /```(?:html)?\s*\n([\s\S]*?)```/
  );
  if (htmlBlockMatch) {
    const inner = htmlBlockMatch[1].trim();
    if (inner.includes('<!DOCTYPE') || inner.includes('<html')) {
      return inner;
    }
    // Could be a partial HTML snippet (for element/section responses)
    return inner;
  }

  // Try to find raw HTML document in the text
  const doctypeIndex = text.indexOf('<!DOCTYPE');
  const htmlTagIndex = text.indexOf('<html');
  const htmlStart = doctypeIndex !== -1 ? doctypeIndex : htmlTagIndex;

  if (htmlStart !== -1) {
    const htmlEnd = text.lastIndexOf('</html>');
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
  const doctypeIndex = accumulated.indexOf('<!DOCTYPE');
  const htmlTagIndex = accumulated.indexOf('<html');
  const htmlStart = doctypeIndex !== -1 ? doctypeIndex : htmlTagIndex;

  if (htmlStart === -1) {
    return { htmlStarted: false, htmlContent: '', isComplete: false };
  }

  const htmlContent = accumulated.slice(htmlStart);
  const isComplete = htmlContent.includes('</html>');

  return { htmlStarted: true, htmlContent, isComplete };
}
