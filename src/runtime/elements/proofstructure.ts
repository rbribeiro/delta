/**
 * Structured proofs and hypotheses (the compiler's structure.ts numbered them):
 *
 * - <step num="1.2"> — a numbered claim with its own folding proof. The number is put in
 *   front of the claim; the step's aids (<intuition>, <strategy>, <obstacle>) become dots
 *   after it, opening a drawer under the claim (aid.ts `buildLens`).
 * - <hyp num="H1"> — a hypothesis in a statement, labelled "(H1)". Its <hyp-uses> child
 *   (where the proof uses it, or that it doesn't; its counterexamples) is hidden in the
 *   page and shown only in a ref's preview of the hypothesis. The labels come from t().
 * - `stepLevels` — the proof's "Steps 1 2 3 All" control: level k unfolds the proofs of
 *   steps above level k, so the reader sees the claims down to level k.
 */

import { t } from "../i18n";
import { buildLens } from "./aid";
import { setFolded } from "./shared";

class DeltaStep extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    const num = document.createElement("span");
    num.className = "step-num";
    num.textContent = this.getAttribute("num") ?? "";
    // The step's own claim: possibly inside a <change><new>, never a nested step's.
    const claim = [...this.querySelectorAll("delta-step-claim")].find(
      (c) => c.closest("delta-step") === this,
    );
    (claim ?? this).prepend(num, " ");
    // Its aids (<intuition>, …): dots after the claim, drawer between claim and proof.
    const lens = buildLens(this);
    if (lens && claim) {
      claim.append(" ", lens.dots);
      claim.after(lens.drawer);
    }
  }
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
 * The "Steps 1 2 … All" control for a proof whose steps nest `depth` levels deep. Level k
 * shows every claim down to level k: the proofs of steps at levels below k unfold, the
 * rest fold. "All" unfolds every step proof.
 */
export function stepLevels(proof: HTMLElement, depth: number): HTMLElement {
  const box = document.createElement("span");
  box.className = "step-levels";
  const name = document.createElement("span");
  name.className = "step-levels-label";
  name.textContent = t("stepLevel", "Steps");
  box.append(name);

  const buttons: HTMLButtonElement[] = [];
  const show = (k: number, active: HTMLButtonElement): void => {
    for (const p of proof.querySelectorAll<HTMLElement>("delta-proof[data-depth]")) {
      setFolded(p, Number(p.dataset.depth) >= k);
    }
    for (const b of buttons) b.setAttribute("aria-pressed", String(b === active));
  };
  const add = (label: string, k: number): void => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.title = t("stepLevelHint", "Expand the proof to this level");
    // The control sits in the proof's lead, which may itself be a fold toggle.
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      show(k, b);
    });
    b.addEventListener("keydown", (e) => e.stopPropagation());
    buttons.push(b);
    box.append(b);
  };
  for (let k = 1; k <= depth; k++) add(String(k), k);
  add(t("all", "All"), Infinity);
  buttons[0].setAttribute("aria-pressed", "true");
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
