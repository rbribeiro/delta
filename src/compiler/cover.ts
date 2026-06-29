import type { ElementNode } from "./ast";

/**
 * Presentation cover. `<cover>` (a direct child of `<document>`) is the deck's front
 * page — title, subtitle, author, affiliation, event, date. It's desugared to a
 * `<slide cover="true">` so the deck pages it like any slide and the existing
 * `DeltaSlide` chrome applies; `components/slide.css` lays the fields out (styled by
 * tag). Presentation-only and top-level only — no tree walk. `resolveIncludes` runs
 * before this, so an included cover is already a direct child by now.
 */
export function expandCover(doc: ElementNode): void {
  if (doc.attrs.type !== "presentation") return;
  for (const child of doc.children) {
    if (child.type === "element" && child.tag === "cover") {
      child.tag = "slide";
      child.attrs.cover = "true";
    }
  }
}
