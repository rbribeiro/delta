/**
 * The theorem family and friends. Box environments (theorem, lemma, example, …)
 * become a bordered `.box` with a floating `.box-tag` label; proof/solution get an
 * inline italic `.proof-lead` and, for proof, a trailing QED mark.
 *
 * Adding a numbered environment: a row in the compiler's `environments.ts`, the
 * tag here (ENVIRONMENT_TAGS + the box-vs-proof set), and a label in `strings.ts`.
 */

import { t } from "../i18n";
import { applyCollapsible } from "./shared";

const ENVIRONMENT_TAGS = [
  "theorem",
  "proposition",
  "lemma",
  "corollary",
  "conjecture",
  "definition",
  "example",
  "claim",
  "observation",
  "exercise",
  "problem",
  "proof",
  "solution",
  "remark",
];

// Rendered as a bordered .box with a floating .box-tag label.
const BOX_ENVIRONMENTS = new Set([
  "theorem", "proposition", "lemma", "corollary", "conjecture", "definition",
  "example", "claim", "observation", "exercise", "problem", "remark",
]);
// Rendered inline with an italic lead; proof additionally gets a QED mark.
const PROOF_ENVIRONMENTS = new Set(["proof", "solution"]);

/**
 * Box environments (theorem family, example, …) become a bordered `.box` with a
 * floating `.box-tag` label ("Theorem 1.2 (Title)"); proof/solution get an inline
 * italic `.proof-lead` ("Proof.") and, for proof, a trailing QED mark.
 */
class DeltaEnvironment extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    const tagName = this.tagName.toLowerCase().replace(/^delta-/, "");
    const num = this.getAttribute("num");
    // Localized environment name (e.g. "Teorema"); English capitalization is the fallback.
    let name = t(tagName, tagName.charAt(0).toUpperCase() + tagName.slice(1));
    const title = this.querySelector(":scope > delta-title");

    if (PROOF_ENVIRONMENTS.has(tagName)) {
      const lead = document.createElement("span");
      const ofAttr = this.getAttribute("of");
      const refTag = this.getAttribute("data-target-tag");
      const refNum = this.getAttribute("data-target-num");

      if(refTag && ofAttr && refNum) {
        const refElement = document.createElement("delta-ref");
        refElement.setAttribute("to",ofAttr);
        refElement.setAttribute("data-target-num", refNum);
        refElement.setAttribute("data-target-tag", refTag)
        lead.append(" ");
        lead.append(refElement);
      }
      lead.className = "proof-lead";
      lead.prepend(name);
      if (title) {
        lead.append(" (", ...title.childNodes, ")");
        title.remove();
      }
      lead.append(".");
      this.prepend(lead, " ");
      if (tagName === "proof") {
        const qed = document.createElement("span");
        qed.className = "proof-qed";
        qed.textContent = "□";
        this.append(qed);
      }
      applyCollapsible(this, lead);
      return;
    }

    if (!BOX_ENVIRONMENTS.has(tagName)) return; // unknown environment: leave it bare

    // A floating tag carries the tagName + number (CSS uppercases it) and the
    // optional author title (CSS parenthesises it).
    this.classList.add("box");
    if (tagName === "example") this.classList.add("example");
    const tag = document.createElement("span");
    tag.className = "box-tag";
    tag.textContent = name + (num ? ` ${num}` : "");
    if (title) {
      const titleEl = document.createElement("span");
      titleEl.className = "box-tag-title";
      titleEl.append(...title.childNodes);
      title.remove();
      tag.append(" ", titleEl);
    }
    this.prepend(tag);

    const meta = this.querySelector(":scope > delta-meta");
    if (meta) {
      const metaItems = meta.querySelectorAll(":scope > delta-meta-item");
      if (metaItems.length) {
        const footer = document.createElement("div");
        footer.className = "box-meta";
        for (const item of metaItems) {
          const label = item.getAttribute("key");
          const value = item.innerHTML.trim();
          if (label && value) {
            const pair = document.createElement("span");
            pair.className = "box-meta-item";
            pair.innerHTML = `<span class="k">${label}</span><span class='v'> ${value}</span>`;
            footer.appendChild(pair);
          }
        }
        meta.remove();
        this.append(footer);
      }
    }

    applyCollapsible(this, tag);
  }
}

export function defineEnvironments(): void {
  // define() requires a unique constructor per tag, hence the anonymous subclasses.
  for (const kind of ENVIRONMENT_TAGS) {
    customElements.define(`delta-${kind}`, class extends DeltaEnvironment {});
  }
}
