import type { SourceSpan } from "./compiler/ast";

/**
 * `delta verify`'s one edit: set attributes on an element's opening tag, in place, leaving
 * every other byte of the file as the author wrote it. It is the only command that writes
 * a `.dlt`; everything else about a proof is edited by hand (or by an agent) as text.
 */

/** Escapes a value for a double-quoted XML attribute. */
function escapeAttr(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

/**
 * `text` with the opening tag at `span` rewritten: each attribute in `attrs` replaces the
 * existing value (either quote style), or is appended at the end of the tag.
 */
export function setAttributes(text: string, span: SourceSpan, attrs: Record<string, string>): string {
  let tag = text.slice(span.start, span.inner);
  for (const [name, value] of Object.entries(attrs)) {
    const quoted = `"${escapeAttr(value)}"`;
    const existing = new RegExp(`(\\s${name}\\s*=\\s*)("[^"]*"|'[^']*')`);
    if (existing.test(tag)) {
      tag = tag.replace(existing, (_m, lead: string) => lead + quoted);
    } else {
      // Before the closing `>`, keeping any whitespace (a multi-line tag stays multi-line).
      const body = tag.slice(0, -1);
      const kept = body.trimEnd();
      tag = `${kept} ${name}=${quoted}${body.slice(kept.length)}>`;
    }
  }
  return text.slice(0, span.start) + tag + text.slice(span.inner);
}
