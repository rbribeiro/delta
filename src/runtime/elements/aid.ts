/**
 * Reader aids on a result or a proof step — <intuition>, <strategy>, <obstacle>:
 *
 *   <lemma id="lem:escape">…statement…
 *     <intuition>Why it is true.</intuition>
 *     <strategy>How the proof goes (<ref to="lem:coupling"/>).</strategy>
 *   </lemma>
 *
 * Each aid is a fold of the box's paper, under the statement: closed, a thin folded strip
 * (its name shows on hover); open, a tinted panel that unfolds in place, named in its own
 * header, which folds it back. The order is always intuition, strategy, obstacle, and each
 * opens on its own. `buildFolds` (called by the environment) returns the folds for the
 * box to place. A top-level <step> of a proof's sheet places them under its claim as
 * named folds (`named`: the name printed on the strip), pleats of the same sheet; a step
 * elsewhere keeps them narrow, inside its column (proofstructure.ts).
 * The compiler validated placement and stamped `collapsed` (every aid closed unless the
 * author opened it).
 */

import { t } from "../i18n.ts";
import { AID_TAGS } from "../../language/tags.ts";
import { button, kindOf } from "./shared.ts";

/** The aids in display order: intuition, strategy, obstacle. */
const AIDS = [...AID_TAGS];
const SELECTOR = AIDS.map((a) => `:scope > delta-${a}`).join(", ");

/** How long the paper takes to fold back (the `fold-refold` animation in understanding.css). */
export const REFOLD_MS = 380;

/**
 * Moves `host`'s direct aid children into folds and returns them in a `.folds` block, or
 * null when it has none. In a ref pop-over preview every fold starts closed: the preview
 * is the statement. `named` prints each aid's name on its closed strip.
 */
export function buildFolds(host: HTMLElement, { named = false } = {}): HTMLElement | null {
  const aids = [...host.querySelectorAll<HTMLElement>(SELECTOR)].sort(
    (a, b) => AIDS.indexOf(kindOf(a)) - AIDS.indexOf(kindOf(b)),
  );
  if (aids.length === 0) return null;

  const folds = document.createElement("div");
  folds.className = "folds";
  const inPreview = host.closest(".xref-pop-body") !== null;
  for (const aid of aids) {
    const f = fold(aid, !inPreview && aid.getAttribute("collapsed") === "false");
    if (named) f.dataset.named = "true";
    folds.append(f);
  }
  return folds;
}

/** One aid as a fold: the closed strip, and the panel it unfolds into. */
function fold(aid: HTMLElement, open: boolean): HTMLElement {
  const kind = kindOf(aid);
  const label = t(kind, kind);
  const el = document.createElement("div");
  el.className = "fold";
  el.dataset.aid = kind;

  // Closed: a valley and a mountain of folded paper, wordless but for the tooltip (a
  // named fold prints its name in the valley instead).
  const strip = button("fold-strip");
  strip.dataset.label = label;
  strip.setAttribute("aria-label", label);
  const valley = document.createElement("span");
  valley.className = "fold-valley";
  const printed = document.createElement("span");
  printed.className = "fold-label";
  printed.setAttribute("aria-hidden", "true");
  printed.textContent = label;
  valley.append(printed);
  const mountain = document.createElement("span");
  mountain.className = "fold-mountain";
  strip.append(valley, mountain);

  // Open: the aid on a tinted panel, under a header that folds it back.
  const panel = document.createElement("div");
  panel.className = "fold-panel";
  const name = document.createElement("span");
  name.className = "fold-name";
  name.textContent = label;
  const caret = document.createElement("span");
  caret.className = "fold-caret";
  caret.setAttribute("aria-hidden", "true");
  const head = button("fold-head", name, caret);
  aid.classList.add("fold-body");
  const crease = document.createElement("span");
  crease.className = "fold-crease";
  crease.setAttribute("aria-hidden", "true");
  panel.append(head, aid, crease);
  el.append(strip, panel);

  let timer: number | undefined;
  /** Opens or closes the fold; `focus` takes the keyboard once it is showing. */
  const set = (opening: boolean, animate: boolean, focus?: HTMLElement): void => {
    clearTimeout(timer);
    el.classList.toggle("is-open", opening);
    strip.setAttribute("aria-expanded", String(opening));
    head.setAttribute("aria-expanded", String(opening));
    el.classList.remove("is-unfolding", "is-refolding");
    if (opening) {
      strip.hidden = true;
      panel.hidden = false;
      if (animate) el.classList.add("is-unfolding");
      focus?.focus({ preventScroll: true });
      return;
    }
    const close = (): void => {
      el.classList.remove("is-refolding");
      panel.hidden = true;
      strip.hidden = false;
      focus?.focus({ preventScroll: true });
    };
    if (!animate || matchMedia("(prefers-reduced-motion: reduce)").matches) return close();
    el.classList.add("is-refolding");
    timer = window.setTimeout(close, REFOLD_MS);
  };
  strip.addEventListener("click", () => set(true, true, head));
  head.addEventListener("click", () => set(false, true, strip));
  el.addEventListener("animationend", () => el.classList.remove("is-unfolding"));
  set(open, false);
  return el;
}
