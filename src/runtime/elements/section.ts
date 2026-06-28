/**
 * <chapter>/<section>/<subsection>/<subsubsection> — turns the <delta-title>
 * child into a real heading, prefixed by the compile-time number.
 */

import { applyCollapsible } from "./shared";

// tag → heading level + class the structure stylesheet targets
// (h2.section gets a .num pill; h3.sub / h4.subsub are quieter).
const SECTION_HEADINGS: Record<string, { level: number; cls: string }> = {
  "delta-chapter": { level: 1, cls: "chapter-title" },
  "delta-section": { level: 2, cls: "section" },
  "delta-subsection": { level: 3, cls: "sub" },
  "delta-subsubsection": { level: 4, cls: "subsub" },
};

/** Replaces the <delta-title> child with a real <h1>…<h4>, prefixed by a `.num`. */
class DeltaSection extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    const title = this.querySelector(":scope > delta-title");
    if (!title) return;
    const spec = SECTION_HEADINGS[this.tagName.toLowerCase()] ?? { level: 2, cls: "section" };
    const heading = document.createElement(`h${spec.level}`);
    heading.className = spec.cls;
    const num = this.getAttribute("num");
    if (num) {
      const numEl = document.createElement("span");
      numEl.className = "num";
      numEl.textContent = num;
      heading.append(numEl, " ");
    }
    heading.append(...title.childNodes);
    title.replaceWith(heading);
    applyCollapsible(this, heading);
  }
}

export function defineSections(): void {
  // define() requires a unique constructor per tag, hence the anonymous subclasses.
  for (const tag of Object.keys(SECTION_HEADINGS)) {
    customElements.define(tag, class extends DeltaSection {});
  }
}
