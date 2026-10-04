/**
 * <chapter>/<section>/<subsection>/<subsubsection> — turns the <delta-title>
 * child into a real heading, prefixed by the compile-time number.
 */

import { nameOf } from "../i18n.ts";
import { applyCollapsible, kindOf, renderMeta } from "./shared.ts";
import { applyStatus } from "./status.ts";
import { HEADING_LEVEL } from "../../language/tags.ts";

// tag → the heading class the structure stylesheet targets
// (h2.section gets a .num pill; h3.sub / h4.subsub are quieter).
const HEADING_CLASS: Record<string, string> = {
  chapter: "chapter-title",
  section: "section",
  subsection: "sub",
  subsubsection: "subsub",
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
      applyStatus(this, title); // the pill rides along into the divider's title
      slide.appendChild(title);
      this.prepend(slide);
      return;
    }

    const tag = kindOf(this);
    const heading = document.createElement(`h${HEADING_LEVEL[tag] ?? 2}`);
    heading.className = HEADING_CLASS[tag] ?? "section";
    const num = this.getAttribute("num");
    if (num) {
      const numEl = document.createElement("span");
      numEl.className = "num";
      numEl.textContent = num;
      heading.append(numEl, " ");
    }
    // A chapter opens big: its numeral set large and light beside a small-caps
    // "Chapter 2" over the title (structure.css lays the three out).
    let text: HTMLElement = heading;
    if (tag === "chapter") {
      if (num) {
        const kicker = document.createElement("span");
        kicker.className = "chapter-kicker";
        kicker.setAttribute("aria-hidden", "true"); // the numeral already says it
        kicker.textContent = `${nameOf("chapter")} ${num}`;
        heading.append(kicker);
      }
      text = document.createElement("span");
      text.className = "chapter-name";
      heading.append(text);
    }
    text.append(...title.childNodes);
    title.replaceWith(heading);
    applyStatus(this, text); // status="draft" by="…" on a section → its mark after the title

    renderMeta(this);

    applyCollapsible(this, heading);
  }
}

export function defineSections(): void {
  // define() requires a unique constructor per tag, hence the anonymous subclasses.
  for (const tag of Object.keys(HEADING_LEVEL)) {
    customElements.define(`delta-${tag}`, class extends DeltaSection {});
  }
}
