/**
 * Pure template renderer for `{{merge.field}}` style placeholders.
 * Supports dot paths (`{{contact.firstName}}`), missing values render as empty,
 * and `{{#with name}}…{{/with}}` is NOT supported (keep it dumb — handlebars-lite).
 *
 * Whitespace around the field name is tolerated: `{{ contact.firstName }}`.
 */

export interface RenderContext {
  [key: string]: unknown;
}

const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function renderTemplate(template: string, ctx: RenderContext): string {
  return template.replace(TOKEN, (_match, path: string) => {
    const value = resolvePath(ctx, path);
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

function resolvePath(ctx: RenderContext, path: string): unknown {
  const parts = path.split(".");
  let cur: unknown = ctx;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

/**
 * Return the unique set of merge-field paths present in a template.
 * Useful for showing previews / validating templates before send.
 */
export function extractMergeFields(template: string): string[] {
  const out = new Set<string>();
  for (const match of template.matchAll(TOKEN)) {
    out.add(match[1]);
  }
  return Array.from(out).sort();
}
