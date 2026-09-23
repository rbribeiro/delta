import type { ElementNode } from "./ast";
import type { CompileContext } from "./context";

/**
 * Settles the `<document>` attributes every later pass keys off. Two things happen here,
 * in this order:
 *
 * 1. A project's `[document]` table (`project.toml`) fills in defaults — but only where the
 *    file did not set the attribute itself, so a per-document value always wins. `theme`
 *    arrives already resolved to an absolute path (config.ts did that against the toml).
 * 2. `ctx.lang` is read from the (now complete) `lang` attribute; it drives the i18n island
 *    and `<html lang>`.
 *
 * Runs right after includes so the presentation sugar (`expandAnimated`/`expandCover`), which
 * is gated on `type`, sees a project-wide `type="presentation"`.
 */
export function applyDocumentDefaults(
  doc: ElementNode,
  ctx: CompileContext,
  defaults?: Record<string, string>,
): void {
  if (defaults) {
    for (const [attr, val] of Object.entries(defaults)) {
      if (doc.attrs[attr] === undefined) doc.attrs[attr] = val;
    }
  }
  ctx.lang = doc.attrs.lang ?? "en";
}
