/**
 * The theorem family and friends. Box environments (theorem, lemma, example, …)
 * become a bordered `.box` with a floating `.box-tag` label; proof/solution get an
 * inline italic `.proof-lead` and a trailing QED mark.
 *
 * The tag lists live in `src/language/tags.ts` (BOX_TAGS, PROOF_TAGS), shared with the
 * compiler; adding an environment needs no change here.
 */

import { nameOf } from "../i18n.ts";
import { BOX_TAGS, ENVIRONMENT_TAGS, PROOF_TAGS } from "../../language/tags.ts";
import {
  applyCollapsible,
  applyStatus,
  kindOf,
  numberedName,
  renderMeta,
  takeTitle,
} from "./shared.ts";
import { buildLens } from "./aid.ts";
import { stepLevels } from "./proofstructure.ts";

class DeltaEnvironment extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    const kind = kindOf(this);
    if (PROOF_TAGS.has(kind)) this.renderProof(kind);
    else if (BOX_TAGS.has(kind)) this.renderBox(kind);
    // any other tag: an unknown environment, left bare
  }

  /** "Proof (of Theorem 1.2) (Title)." as an inline lead, the step-level buttons, a QED mark. */
  private renderProof(kind: string): void {
    const lead = document.createElement("span");
    lead.className = "proof-lead";
    lead.append(nameOf(kind));
    const of = this.getAttribute("of");
    const refTag = this.getAttribute("data-target-tag");
    const refNum = this.getAttribute("data-target-num");
    if (of && refTag && refNum) {
      const ref = document.createElement("delta-ref");
      ref.setAttribute("to", of);
      ref.setAttribute("data-target-num", refNum);
      ref.setAttribute("data-target-tag", refTag);
      lead.append(" ", ref);
    }
    const title = takeTitle(this);
    if (title) lead.append(" (", ...title.nodes, ")");
    lead.append(".");
    this.prepend(lead, " ");
    applyStatus(this, lead); // status="sketch" by="…" → pill after "Proof."
    // A structured proof: "Steps 1 2 … All" to unfold it level by level.
    const depth = Number(this.getAttribute("data-step-depth") ?? 0);
    if (depth > 0) lead.append(" ", stepLevels(this, depth));

    const qed = document.createElement("span");
    qed.className = "proof-qed";
    qed.textContent = "□";
    this.append(qed);
    applyCollapsible(this, lead);
  }

  /** A bordered box with a floating "Theorem 1.2 (Title)" tag, its meta row and its reader aids. */
  private renderBox(kind: string): void {
    // The tag carries the name + number (CSS uppercases it) and the optional author
    // title (CSS parenthesises it).
    this.classList.add("box");
    if (kind === "example" || kind === "counterexample") this.classList.add("example");
    const tag = document.createElement("span");
    tag.className = "box-tag";
    tag.textContent = numberedName(kind, this.getAttribute("num"));
    const title = takeTitle(this);
    if (title) {
      const titleEl = document.createElement("span");
      titleEl.className = "box-tag-title";
      titleEl.append(...title.nodes);
      tag.append(" ", titleEl);
    }
    this.prepend(tag);
    applyStatus(this, tag); // status/by/verified-by → pill inside the label (stays out of the fold)

    const meta = renderMeta(this);
    if (meta) this.append(meta); // at the bottom of the box

    // Reader aids (<intuition>, <strategy>, …) → dots on the top border, and a drawer
    // hung right after the box, so a long aid never stretches the statement.
    const lens = buildLens(this);
    if (lens) {
      this.append(lens.dots);
      this.after(lens.drawer);
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
