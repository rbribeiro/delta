import { elements, type ElementNode } from "./ast";

/**
 * `animated="true"` is authoring sugar for the reveal fragment system: it marks
 * every child *element* of the carrier with `reveal="true"`, so a whole slide (or
 * list, etc.) discloses one piece at a time without tagging each child by hand.
 * The pass just resolves the shorthand into the same `reveal` data item 37's deck
 * controller already consumes — no runtime/CSS involvement.
 *
 * Rules:
 * - Presentation-only: a no-op (no tree walk) outside `type="presentation"`, since
 *   `animated`/`reveal` have no effect in any other document type.
 * - Direct children only — nesting works because `elements()` also visits a nested
 *   `animated` element, which then expands its own children ("repeat the process").
 * - `<title>` (always visible) and `<slide>` (paged, never a fragment) are skipped.
 * - An explicit `reveal` on a child wins, so `reveal="false"` opts a child out and a
 *   hand-set `reveal-order` is preserved.
 */
const NEVER_REVEAL = new Set(["title", "slide"]);

export function expandAnimated(doc: ElementNode): void {
  if (doc.attrs.type !== "presentation") return;
  for (const el of elements(doc)) {
    if (el.attrs.animated !== "true") continue;
    for (const child of el.children) {
      if (child.type !== "element" || NEVER_REVEAL.has(child.tag)) continue;
      if (child.attrs.reveal === undefined) child.attrs.reveal = "true";
    }
  }
}
