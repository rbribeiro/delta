/**
 * Structured proofs and hypotheses (the compiler's structure.ts numbered them):
 *
 * - <step num="1.2"> — a numbered claim with its proof. A top-level step of a proof drawn
 *   as a sheet (a proof joined to its box, or a standalone proof with steps) is a pleat of
 *   that sheet: folded, its number and claim are printed on the fold; a click lays it flat
 *   and shows its proof. Its aids are named folds of the same sheet, under the claim, and
 *   stay reachable while the step is folded. Any other step (a sub-step, a step in a ref
 *   preview) reads flat: number, claim, its proof right below, its aids narrow folds in
 *   its column. Steps never fold inside steps.
 * - <hyp num="H1"> — a hypothesis in a statement, labelled "(H1)". Its <hyp-uses> child
 *   (where the proof uses it, or that it doesn't; its counterexamples) is hidden in the
 *   page and shown only in a ref's preview of the hypothesis. The labels come from t().
 * - `stepsControl` — the sheet's "Steps only · Full proof", which folds or lays flat every
 *   top-level step at once.
 *
 * The environments upgrade first (elements/index.ts), so a step finds its sheet already
 * drawn and its own proof already marked `.step-body` (environment.ts).
 */

import { t } from "../i18n.ts";
import { REFOLD_MS, buildFolds } from "./aid.ts";
import { button, setFolded } from "./shared.ts";
import { applyStatus } from "./status.ts";

/** The proof, solution or step `el` belongs to: its nearest such ancestor. */
export const ownerOf = (el: Element): Element | null =>
  el.parentElement?.closest("delta-step, delta-proof, delta-solution") ?? null;

/** `step`'s own part matching `selector`: never a nested step's (it may sit in a <change>). */
const own = (step: Element, selector: string): HTMLElement | undefined =>
  [...step.querySelectorAll<HTMLElement>(selector)].find((e) => ownerOf(e) === step);

/** The direct child of `step` that holds `el` (`el` itself, or a <change> around it). */
function topOf(step: Element, el: Element): Element {
  let top = el;
  while (top.parentElement && top.parentElement !== step) top = top.parentElement;
  return top;
}

/** The nearest sibling of `el` that shows something (not blank text, not a comment). */
function shown(el: Element, dir: "previousSibling" | "nextSibling"): Node | null {
  let n = el[dir];
  while (
    n &&
    (n.nodeType === Node.COMMENT_NODE || (n.nodeType === Node.TEXT_NODE && !n.textContent?.trim()))
  )
    n = n[dir];
  return n;
}

class DeltaStep extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    const num = document.createElement("span");
    num.className = "step-num";
    num.textContent = this.getAttribute("num") ?? "";
    const claim = own(this, "delta-step-claim");
    const proof = own(this, "delta-proof");
    const sheet = ownerOf(this);
    const pleat =
      this.getAttribute("depth") === "1" &&
      sheet !== null &&
      (sheet.classList.contains("proof-foot") || sheet.classList.contains("proof-sheet")) &&
      !this.closest(".xref-pop-body");
    if (!pleat) {
      // Flat: the number in front of the claim, the aids under it, the proof below.
      (claim ?? this).prepend(num, " ");
      const folds = buildFolds(this);
      if (folds) (claim ? topOf(this, claim) : num).after(folds);
      if (proof) applyStatus(proof, claim ?? null);
      return;
    }

    // A pleat of the sheet: a header row holding the number and the claim (the valley of
    // the fold, with the mountain under it), the aids as named folds, then the proof,
    // which the header folds.
    this.classList.add("step-pleat");
    // Pleats stack edge to edge; the first one meets the bar, the last one the QED.
    const before = shown(this, "previousSibling");
    if (before === null) this.classList.add("at-top");
    else if (before instanceof Element && before.localName === "delta-step")
      this.classList.add("after-step");
    const after = shown(this, "nextSibling");
    if (after instanceof Element && after.localName === "delta-step")
      this.classList.add("before-step");
    if (after === null || (after instanceof Element && after.classList.contains("proof-qed")))
      this.classList.add("at-end");
    const head = document.createElement("div");
    head.className = "step-head";
    const text = document.createElement("span");
    text.className = "step-text";
    if (claim) text.append(topOf(this, claim));
    head.append(num, text);
    if (proof) applyStatus(proof, head);
    const mountain = document.createElement("span");
    mountain.className = "step-mountain";
    mountain.setAttribute("aria-hidden", "true");
    this.prepend(head, mountain);
    const folds = buildFolds(this, { named: true });
    if (folds) mountain.after(folds);
    if (!proof) return; // nothing to unfold: the claim lies flat

    this.classList.add("has-body");
    const caret = document.createElement("span");
    caret.className = "step-caret";
    caret.setAttribute("aria-hidden", "true");
    head.append(caret);
    head.classList.add("collapse-toggle");
    head.setAttribute("role", "button");
    head.tabIndex = 0;
    setFolded(this, proof.getAttribute("collapsed") !== "false");
    const flip = (): void => foldStep(this, !this.classList.contains("is-collapsed"));
    head.addEventListener("click", flip);
    head.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.target !== head || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      flip();
    });
    proof.addEventListener("animationend", (e) => {
      if (e.target === proof) this.classList.remove("is-unfolding");
    });
  }
}

const timers = new WeakMap<Element, number>();

/** Folds or lays flat a pleated step, the paper moving unless the reader asked for less motion. */
export function foldStep(step: HTMLElement, folding: boolean): void {
  clearTimeout(timers.get(step));
  step.classList.remove("is-unfolding", "is-refolding");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!folding) {
    const was = step.classList.contains("is-collapsed");
    setFolded(step, false);
    if (was && !still) step.classList.add("is-unfolding");
    return;
  }
  if (step.classList.contains("is-collapsed")) return;
  if (still) return setFolded(step, true);
  step.classList.add("is-refolding");
  timers.set(
    step,
    window.setTimeout(() => {
      step.classList.remove("is-refolding");
      setFolded(step, true);
    }, REFOLD_MS),
  );
}

class DeltaHyp extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    const label = document.createElement("span");
    label.className = "hyp-num";
    label.textContent = `(${this.getAttribute("num") ?? ""})`;
    this.prepend(label, " ");
  }
}

/** A part of <hyp-uses> that starts with a localized label. */
function labelled(key: string, fallback: string, text?: string): typeof HTMLElement {
  return class extends HTMLElement {
    connectedCallback(): void {
      if (this.dataset.deltaReady) return;
      this.dataset.deltaReady = "1";
      if (text !== undefined) {
        this.textContent = t(key, fallback);
        return;
      }
      const head = document.createElement("span");
      head.className = "hyp-uses-label";
      head.textContent = `${t(key, fallback)}: `;
      this.prepend(head);
    }
  };
}

/**
 * "Steps only · Full proof" for the sheet `proof`: folds every top-level step, or lays
 * them all flat. Each button is pressed while the steps are all that way; a step folded
 * by hand (or unfolded by a jump to it) updates them.
 */
export function stepsControl(proof: HTMLElement): HTMLElement {
  const box = document.createElement("span");
  box.className = "steps-control";
  const steps = (): HTMLElement[] =>
    [...proof.querySelectorAll<HTMLElement>("delta-step.step-pleat.has-body")].filter(
      (s) => ownerOf(s) === proof,
    );
  const folded = button("", t("onlySteps", "Steps only"));
  const flat = button("", t("fullProof", "Full proof"));
  const sync = (): void => {
    const all = steps();
    const shut = all.filter((s) => s.classList.contains("is-collapsed")).length;
    folded.setAttribute("aria-pressed", String(all.length > 0 && shut === all.length));
    flat.setAttribute("aria-pressed", String(all.length > 0 && shut === 0));
  };
  for (const [b, folding] of [
    [folded, true],
    [flat, false],
  ] as const) {
    // The control sits in the proof's bar, which is itself a fold toggle.
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      for (const s of steps()) foldStep(s, folding);
    });
    b.addEventListener("keydown", (e) => e.stopPropagation());
    box.append(b);
  }
  // The steps upgrade after the sheet: watch them once they have.
  queueMicrotask(() => {
    const watch = new MutationObserver(sync);
    for (const s of steps()) watch.observe(s, { attributes: true, attributeFilter: ["class"] });
    sync();
  });
  return box;
}

export function defineProofStructure(): void {
  customElements.define("delta-step", DeltaStep);
  customElements.define("delta-hyp", DeltaHyp);
  customElements.define("delta-hyp-used", labelled("usedIn", "Used in"));
  customElements.define("delta-hyp-needed", labelled("brokenBy", "Needed, see"));
  customElements.define("delta-hyp-unused", labelled("notUsed", "Not used in the proof", ""));
  customElements.define("delta-hyp-in-proof", labelled("theProof", "the proof", ""));
}
