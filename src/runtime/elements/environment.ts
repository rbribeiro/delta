/**
 * The theorem family and friends. A box environment (theorem, lemma, example, …) becomes a
 * card: a header ("LEMMA 2.1.2  Coupling", its status mark at the end), the statement, the
 * folds of its reader aids, and at its foot the proofs that belong with it. A proof or
 * solution the compiler joined to its box (`data-attached`: nested in it, or right after
 * it) is drawn as that foot, a bar that unfolds it; any other proof keeps an inline italic
 * `.proof-lead` and a trailing QED mark.
 *
 * The tag lists live in `src/language/tags.ts` (BOX_TAGS, PROOF_TAGS), shared with the
 * compiler; adding an environment needs no change here.
 */

import { nameOf, t } from "../i18n.ts";
import { BOX_TAGS, ENVIRONMENT_TAGS, PROOF_TAGS } from "../../language/tags.ts";
import { applyCollapsible, kindOf, numberedName, renderMeta, takeTitle } from "./shared.ts";
import { applyStatus } from "./status.ts";
import { buildFolds } from "./aid.ts";
import { ownerOf, stepsControl } from "./proofstructure.ts";

/** Does `el` carry any status mark (status, by, verified-by)? */
const marked = (el: Element): boolean =>
  el.hasAttribute("status") || el.hasAttribute("by") || el.hasAttribute("verified-by");

/** Review notes, which may sit between a box and its proof (the compiler skips them too). */
const NOTES = new Set(["comment", "todo"]);

/** A proof or solution the compiler joined to the box before it (or around it). */
const joined = (el: Element | null): boolean =>
  el !== null && PROOF_TAGS.has(kindOf(el)) && el.getAttribute("data-attached") === "true";

class DeltaEnvironment extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    const kind = kindOf(this);
    if (PROOF_TAGS.has(kind)) {
      if (joined(this)) this.renderSheet(kind);
      else if (ownerOf(this)?.localName === "delta-step") this.classList.add("step-body");
      else if (this.hasAttribute("data-step-depth")) this.renderSheet(kind, true);
      else this.renderProof(kind);
    } else if (BOX_TAGS.has(kind)) this.renderBox(kind);
    // any other tag: an unknown environment, left bare
  }

  /** "Proof (of Theorem 1.2) (Title)." as an inline lead and a QED mark. */
  private renderProof(kind: string): void {
    const lead = document.createElement("span");
    lead.className = "proof-lead";
    lead.append(nameOf(kind));
    const ref = this.targetRef();
    if (ref) lead.append(" ", ref);
    const title = takeTitle(this);
    if (title) lead.append(" (", ...title.nodes, ")");
    lead.append(".");
    this.prepend(lead, " ");
    applyStatus(this, lead); // status="sketch" by="…" → its mark after "Proof."
    this.append(qed());
    applyCollapsible(this, lead);
  }

  /** A ref to what the proof proves ("Theorem 1.2"), when the compiler resolved one. */
  private targetRef(): HTMLElement | null {
    const of = this.getAttribute("of");
    const refTag = this.getAttribute("data-target-tag");
    const refNum = this.getAttribute("data-target-num");
    if (!of || !refTag || !refNum) return null;
    const ref = document.createElement("delta-ref");
    ref.setAttribute("to", of);
    ref.setAttribute("data-target-num", refNum);
    ref.setAttribute("data-target-tag", refTag);
    return ref;
  }

  /**
   * A proof or solution drawn as a sheet under a bar ("Proof ▸", "Show solution ▸") that
   * unfolds it. At the foot of its box it starts folded unless the author or the document
   * opened it, and its status shows in the bar unless the box already shows it in its
   * header. Standing alone (a proof with steps away from its box), the bar names what it
   * proves and the sheet starts open. With steps, the bar offers "Steps only · Full proof".
   */
  private renderSheet(kind: string, alone = false): void {
    this.classList.add(alone ? "proof-sheet" : "proof-foot");
    const bar = document.createElement("div");
    bar.className = "proof-bar";
    const name = document.createElement("span");
    name.className = "proof-bar-name";
    if (kind === "solution") {
      // The bar says what a click does; CSS shows the half that matches the fold.
      const show = document.createElement("span");
      show.className = "when-folded";
      show.textContent = t("showSolution", "Show solution");
      const hide = document.createElement("span");
      hide.className = "when-open";
      hide.textContent = t("hideSolution", "Hide solution");
      name.append(show, hide);
    } else {
      name.append(nameOf(kind));
    }
    const ref = alone ? this.targetRef() : null;
    if (ref) name.append(" ", ref);
    const title = takeTitle(this);
    if (title) name.append(" (", ...title.nodes, ")");
    bar.append(name);
    if (this.hasAttribute("data-step-depth")) bar.append(stepsControl(this));
    if (!this.hasAttribute("data-status-shown")) applyStatus(this, bar);
    const caret = document.createElement("span");
    caret.className = "proof-bar-caret";
    caret.setAttribute("aria-hidden", "true");
    // With steps, the far end holds the steps control: the caret follows the name.
    if (this.hasAttribute("data-step-depth")) name.after(caret);
    else bar.append(caret);
    this.prepend(bar);
    if (kind === "proof") this.append(qed());
    // The bar always folds the sheet; `collapsed` only says how it starts.
    this.setAttribute("collapsible", "true");
    applyCollapsible(this, bar);
    if (this.hasAttribute("data-step-depth")) {
      this.classList.add("has-steps");
      paperRuns(this, this.querySelector<HTMLElement>(":scope > .collapse-body")!);
    }
  }

  /**
   * The card: a header row with the label, the title and the status mark; the statement;
   * the folds of its aids; and its foot — the proofs joined to it, or a line saying where
   * the proof is (or that it is still to come).
   */
  private renderBox(kind: string): void {
    this.classList.add("box");
    const head = document.createElement("div");
    head.className = "box-head";
    const tag = document.createElement("span");
    tag.className = "box-tag";
    tag.textContent = numberedName(kind, this.getAttribute("num"));
    head.append(tag);
    const title = takeTitle(this);
    if (title) {
      const titleEl = document.createElement("span");
      titleEl.className = "box-tag-title";
      titleEl.append(...title.nodes);
      head.append(titleEl);
    }

    // Its proofs: the ones nested in it, then the ones right after it.
    const proofs = [...this.children].filter(joined) as HTMLElement[];
    for (let next = this.nextElementSibling; next; next = next.nextElementSibling) {
      if (NOTES.has(kindOf(next))) continue; // a comment between them does not part them
      if (!joined(next)) break;
      proofs.push(next as HTMLElement);
    }
    for (const p of proofs) p.remove();

    // The sheet is the statement's paper (its texture tells the status); the folds and
    // the foot hang under it, each painting its own strip of the card.
    const body = document.createElement("div");
    body.className = "box-body";
    body.append(...this.childNodes);
    const sheet = document.createElement("div");
    sheet.className = "box-sheet";
    sheet.append(head, body);
    this.append(sheet);

    // The header shows the box's own status or, without one, its first proof's: that is
    // the result's trust. The paper of the whole card follows it.
    const first = proofs[0];
    const from = !marked(this) && first && marked(first) ? first : this;
    if (from !== this) from.setAttribute("data-status-shown", "true");
    applyStatus(this, head, from);

    const meta = renderMeta(body);
    if (meta) body.append(meta); // at the bottom of the statement
    const folds = buildFolds(body);
    if (folds) this.append(folds);
    const foot = proofs.length ? null : this.footNote();
    this.append(...proofs);
    if (foot) this.append(foot);
    if (proofs.length || foot) this.classList.add("has-foot");
    else if (folds) this.classList.add("has-folds");

    // Folding hides the statement (the header's siblings) and, by CSS, what hangs under it.
    applyCollapsible(this, head);
  }

  /** "Proof in Section 2.3" (a ref to the proof), "Proof pending", or nothing. */
  private footNote(): HTMLElement | null {
    if (this.closest(".xref-pop-body")) return null; // a preview is the statement only
    const foot = document.createElement("div");
    foot.className = "box-foot";
    const at = this.getAttribute("data-proof-at");
    if (at) {
      const tag = this.getAttribute("data-proof-at-tag") ?? "proof";
      const ref = document.createElement("delta-ref");
      ref.setAttribute("to", at);
      ref.setAttribute("data-target-tag", tag);
      ref.setAttribute("data-target-num", this.getAttribute("data-proof-at-num") ?? "");
      const href = this.getAttribute("data-proof-at-href");
      if (href) ref.setAttribute("data-target-href", href);
      foot.classList.add("proof-elsewhere");
      if (tag === "proof") {
        ref.textContent = t("seeProof", "See the proof");
        foot.append(ref);
      } else {
        const lead = tag === "chapter" ? t("proofInChapter", "Proof in") : t("proofIn", "Proof in");
        foot.append(`${lead} `, ref);
      }
      return foot;
    }
    if (this.getAttribute("data-proof") === "pending") {
      foot.classList.add("proof-pending");
      foot.textContent = t("proofPending", "Proof pending");
      return foot;
    }
    return null;
  }
}

/**
 * A sheet with steps paints no paper of its own: its top-level steps are pleats whose
 * cut corners must show the page, so the card's edge (a filter on the whole) zig-zags
 * with them. Everything else in the sheet's body, each run of prose between steps, goes
 * into a `.sheet-run` that paints its own strip of the sheet; a run holding only the QED
 * (or an empty one, added when the sheet ends on a step) closes the sheet.
 */
function paperRuns(proof: HTMLElement, body: HTMLElement): void {
  const blank = (n: Node): boolean =>
    n.nodeType === Node.COMMENT_NODE || (n.nodeType === Node.TEXT_NODE && !n.textContent?.trim());
  const pleat = (n: Node): boolean =>
    n instanceof Element &&
    (n.localName === "delta-step" ||
      [...n.querySelectorAll("delta-step")].some((s) => ownerOf(s) === proof));
  const runs: HTMLElement[] = [];
  let run: HTMLElement | null = null;
  for (const node of [...body.childNodes]) {
    if (pleat(node)) {
      run = null;
      continue;
    }
    if (!run) {
      if (blank(node)) continue; // between two steps: nothing to paint
      run = document.createElement("div");
      run.className = "sheet-run";
      node.before(run);
      runs.push(run);
    }
    run.append(node);
  }
  const last = runs.at(-1);
  if (!last || last !== [...body.children].at(-1)) {
    const end = document.createElement("div");
    end.className = "sheet-run";
    body.append(end);
    runs.push(end);
  }
  for (const r of runs) {
    const shown = [...r.childNodes].filter((n) => !blank(n));
    if (shown.every((n) => n instanceof Element && n.classList.contains("proof-qed")))
      r.classList.add("sheet-end");
  }
}

/** The end-of-proof mark. */
function qed(): HTMLElement {
  const mark = document.createElement("span");
  mark.className = "proof-qed";
  mark.textContent = "□"; // □
  return mark;
}

export function defineEnvironments(): void {
  // define() requires a unique constructor per tag, hence the anonymous subclasses.
  for (const kind of ENVIRONMENT_TAGS) {
    customElements.define(`delta-${kind}`, class extends DeltaEnvironment {});
  }
}
