/**
 * Front matter for papers — `<abstract>` plus the labeled metadata that follows it:
 * `<keywords>`, `<msc>` (Mathematics Subject Classification), the publication dates
 * `<date>`/`<submitted>`/`<received>`/`<revised>`/`<accepted>`, and
 * `<acknowledgements>`/`<funding>`. The compiler passes them through untouched (no
 * numbering — they aren't environments); these elements render the chrome, composing
 * the localized label via `t()` like the environment headers / table labels.
 *
 *   <abstract>We prove …</abstract>
 *   <keywords>spectral theory, Schrödinger operators</keywords>
 *   <msc>35P15, 47A10</msc>
 *   <received>2026-01-12</received>  <accepted>2026-05-03</accepted>
 *   <acknowledgements>The author thanks …</acknowledgements>
 *   <funding>Supported by NSF grant …</funding>
 *
 * A presentation `<cover>` also has a `<date>` field, owned by the deck (slide.css);
 * the labeled elements skip when inside a slide so a cover's date is left alone, and
 * the CSS keys off the `.fm-line`/`.fm-block` classes added here (never the bare tag).
 */

import { t } from "../i18n";

// tag (sans `delta-`) → English fallback label. The i18n island supplies the
// localized text via t(); the fallback only matters if a key is missing.
const FM_LABELS: Record<string, string> = {
  keywords: "Keywords",
  msc: "Mathematics Subject Classification",
  received: "Received",
  revised: "Revised",
  accepted: "Accepted",
  submitted: "Submitted",
  date: "Date",
  acknowledgements: "Acknowledgements",
  funding: "Funding",
};
// Rendered as small blocks (a run-in label + paragraph) rather than compact lines.
const FM_BLOCK = new Set(["acknowledgements", "funding"]);

/** `<abstract>` — a centered "Abstract" heading over the (centered, justified) body. */
class DeltaAbstract extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const heading = document.createElement("div");
    heading.className = "abstract-label";
    heading.textContent = t("abstract", "Abstract");
    const body = document.createElement("div");
    body.className = "abstract-body";
    body.append(...this.childNodes);
    this.append(heading, body);
  }
}

/** The labeled metadata lines/blocks — one class, registered per tag. */
class DeltaFrontMatter extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    // A cover slide also carries a <date>; the deck styles it (slide.css). Leave it.
    if (this.closest("delta-slide")) return;

    const key = this.tagName.slice("DELTA-".length).toLowerCase();
    const block = FM_BLOCK.has(key);
    this.classList.add(block ? "fm-block" : "fm-line");
    const label = document.createElement("span");
    label.className = "fm-label";
    label.textContent = t(key, FM_LABELS[key] ?? key);
    this.prepend(label, block ? " " : ": ");
  }
}

export function defineFrontMatter(): void {
  customElements.define("delta-abstract", class extends DeltaAbstract {});
  // define() needs a unique constructor per tag, hence the anonymous subclasses.
  for (const tag of Object.keys(FM_LABELS)) {
    customElements.define(`delta-${tag}`, class extends DeltaFrontMatter {});
  }
}
