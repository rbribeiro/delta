/**
 * <bibliography> — the references list. The compiler fills it with the cited
 * `<delta-paper>` entries in citation order (only cited papers ship); this lifts
 * them into a numbered `<ol class="notes">` whose `<li id="…">` is the jump target
 * for a `<cite>` link. Each entry is formatted by the shared `formatPaper`.
 */

import { t } from "../i18n";
import { formatPaper } from "./shared";

class DeltaBibliography extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const papers = this.querySelectorAll(":scope > delta-paper");
    if (papers.length === 0) return; // nothing cited

    const section = document.createElement("section");
    section.className = "notes";
    const heading = document.createElement("h4");
    heading.textContent = t("references", "References");
    section.append(heading);

    const list = document.createElement("ol");
    for (const paper of papers) {
      const li = document.createElement("li");
      if (paper.id) li.id = paper.id; // anchor for the cite jump
      li.append(formatPaper(paper));
      list.append(li);
    }
    section.append(list);
    this.replaceChildren(section);
  }
}

export function defineBibliography(): void {
  customElements.define("delta-bibliography", class extends DeltaBibliography {});
}
