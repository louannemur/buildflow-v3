// @ mention reference resolver for design prompts
// Detects @page:Name, @feature:Name, @flow:Name
// and expands them into context for the AI

export interface Reference {
  type: 'page' | 'feature' | 'flow';
  name: string;
  raw: string; // the original @mention text
  context: string; // the expanded context string
}

export interface ReferenceOption {
  type: 'page' | 'feature' | 'flow';
  label: string;
  value: string; // what gets inserted: @page:Home, etc.
}

export interface ResolveResult {
  resolvedPrompt: string;
  references: Reference[];
}

export interface ProjectContext {
  pages: Array<{ id: string; title: string; contents: Array<{ name: string; description: string }> | null }>;
  features: Array<{ title: string; description: string }>;
  flows: Array<{ title: string; steps: unknown[] }>;
}

// Pattern: @type:Name
const REFERENCE_PATTERN = /@(page|feature|flow)(?::([^\s,;.!?]+(?:\s+[^\s,;.!?@]+)*))?/gi;

export function resolveReferences(
  prompt: string,
  project: ProjectContext
): ResolveResult {
  const references: Reference[] = [];
  let resolvedPrompt = prompt;

  // Collect all matches first
  const matches: Array<{ raw: string; type: string; name: string; index: number }> = [];
  let match: RegExpExecArray | null;

  // Reset regex
  REFERENCE_PATTERN.lastIndex = 0;
  while ((match = REFERENCE_PATTERN.exec(prompt)) !== null) {
    matches.push({
      raw: match[0],
      type: match[1].toLowerCase(),
      name: (match[2] || '').trim(),
      index: match.index,
    });
  }

  // Process matches in reverse order so indices stay valid
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    const ref = resolveReference(m.type, m.name, m.raw, project);
    if (ref) {
      references.unshift(ref); // maintain order
    }
  }

  // Build context appendix from all references
  if (references.length > 0) {
    const contextBlocks = references.map((ref) => ref.context);
    resolvedPrompt = prompt + '\n\n---\nReferenced context:\n' + contextBlocks.join('\n\n');
  }

  return { resolvedPrompt, references };
}

function resolveReference(
  type: string,
  name: string,
  raw: string,
  project: ProjectContext
): Reference | null {
  switch (type) {
    case 'page': {
      const page = project.pages.find(
        (p) => p.title.toLowerCase() === name.toLowerCase()
      );
      if (!page) return null;

      const contents = page.contents
        ? page.contents.map((c) => `${c.name}: ${c.description}`).join(', ')
        : '';
      let context = `[Page: ${page.title}]`;
      if (contents) context += ` Contents: ${contents}`;

      return { type: 'page', name: page.title, raw, context };
    }

    case 'feature': {
      const feature = project.features.find(
        (f) => f.title.toLowerCase() === name.toLowerCase()
      );
      if (!feature) return null;

      const context = `[Feature: ${feature.title}]\nDescription: ${feature.description}`;
      return { type: 'feature', name: feature.title, raw, context };
    }

    case 'flow': {
      const flow = project.flows.find(
        (f) => f.title.toLowerCase() === name.toLowerCase()
      );
      if (!flow) return null;

      const steps = Array.isArray(flow.steps)
        ? flow.steps
            .map((s: unknown, i: number) => {
              if (typeof s === 'object' && s !== null && 'title' in s) {
                const step = s as { title: string; description?: string };
                return `  ${i + 1}. ${step.title}${step.description ? ': ' + step.description : ''}`;
              }
              return `  ${i + 1}. ${String(s)}`;
            })
            .join('\n')
        : '';
      const context = `[Flow: ${flow.title}]${steps ? '\nSteps:\n' + steps : ''}`;
      return { type: 'flow', name: flow.title, raw, context };
    }

    default:
      return null;
  }
}

/**
 * Build the list of available @ mention options from the current project.
 */
export function getAvailableReferences(project: ProjectContext): ReferenceOption[] {
  const options: ReferenceOption[] = [];

  // Pages
  for (const page of project.pages) {
    options.push({
      type: 'page',
      label: page.title,
      value: `@page:${page.title}`,
    });
  }

  // Features
  for (const feature of project.features) {
    options.push({
      type: 'feature',
      label: feature.title,
      value: `@feature:${feature.title}`,
    });
  }

  // Flows
  for (const flow of project.flows) {
    options.push({
      type: 'flow',
      label: flow.title,
      value: `@flow:${flow.title}`,
    });
  }

  return options;
}

export const REFERENCE_TYPE_LABELS: Record<string, string> = {
  page: 'Pages',
  feature: 'Features',
  flow: 'Flows',
};

export const REFERENCE_TYPE_ORDER: string[] = [
  'page',
  'feature',
  'flow',
];
