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

    // Presentation deck: a section is a group divider, not an inline heading. Move
    // its title into a centered divider slide (the deck pages it like any slide);
    // the section's child <slide>s follow. `display: contents` (slide.css) drops the
    // section's own box. defineSlide() runs right after defineSections(), so this new
    // <delta-slide> upgrades before the deck controller collects slides.
    if (document.documentElement.dataset.type === "presentation") {
      const slide = document.createElement("delta-slide");
      slide.setAttribute("divider", "true");
      slide.appendChild(title);
      this.prepend(slide);
      return;
    }

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

    // render the meta info 
    const meta = this.querySelector(':scope > delta-meta');
    if (meta) {
      const metaItems = meta.querySelectorAll(':scope > delta-meta-item');
      if (metaItems.length) {
        const boxMetaDiv = document.createElement("div");
        boxMetaDiv.classList.add("box-meta");
        Array.from(metaItems).forEach(element => {
          const boxMetaItem = document.createElement("span")
          boxMetaItem.className = "box-meta-item";
          const metaItemKey = document.createElement("span")
          metaItemKey.className = "k"
          metaItemKey.textContent = element.getAttribute("key") ?? "";
          const metaItemValue = document.createElement("span");
          metaItemValue.innerHTML = element.innerHTML;
          metaItemValue.className = "v"

          boxMetaItem.append(metaItemKey)
          boxMetaItem.append(metaItemValue)
          boxMetaDiv.append(boxMetaItem)
          meta.replaceWith(boxMetaDiv)
        });
      }
    }

    applyCollapsible(this, heading);
  }
}

export function defineSections(): void {
  // define() requires a unique constructor per tag, hence the anonymous subclasses.
  for (const tag of Object.keys(SECTION_HEADINGS)) {
    customElements.define(tag, class extends DeltaSection { });
  }
}
