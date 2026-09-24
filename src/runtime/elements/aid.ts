/**
 * Reader aids on a result — <intuition>, <strategy>, <obstacle>, <heuristic>:
 *
 *   <lemma id="lem:escape">…statement…
 *     <intuition>Why it is true.</intuition>
 *     <strategy>How the proof goes (<ref to="lem:coupling"/>).</strategy>
 *   </lemma>
 *
 * An aid can be as long as the proof, so it never lives inside the box: `buildLens`
 * (called by the environment) leaves a small cluster of coloured dots on the box's top
 * border, opposite the label, and moves the aids into a drawer that hangs *under* the
 * box. A dot opens its aid in the drawer (one at a time); the box keeps the size of its
 * statement. Outside a box (a <heuristic> in a proof or in body text) an aid is a small
 * labelled block that folds with the shared collapsible. The compiler validated
 * placement and stamped `collapsed` (every aid hidden unless the author opened it).
 */

import { t } from "../i18n";
import { applyCollapsible } from "./shared";

const AIDS = ["intuition", "strategy", "obstacle", "heuristic"];
const SELECTOR = AIDS.map((a) => `:scope > delta-${a}`).join(", ");

const kindOf = (el: Element): string => el.tagName.toLowerCase().replace(/^delta-/, "");

/** The dots (for the box's top border) and the drawer (for right after the box). */
export interface Lens {
  dots: HTMLElement;
  drawer: HTMLElement;
}

/**
 * Moves `host`'s direct aid children into a drawer and returns it with its dots, or
 * null when the host has none. The caller places the drawer after the host, so an open
 * aid extends the page below the box instead of stretching it. In a ref pop-over
 * preview everything starts folded: the preview is the statement plus the dots.
 */
export function buildLens(host: HTMLElement): Lens | null {
  const aids = [...host.querySelectorAll<HTMLElement>(SELECTOR)].sort(
    (a, b) => AIDS.indexOf(kindOf(a)) - AIDS.indexOf(kindOf(b)),
  );
  if (aids.length === 0) return null;

  const dots = document.createElement("span");
  dots.className = "lens-dots";
  const drawer = document.createElement("div");
  drawer.className = "lens-drawer";

  const buttons = new Map<HTMLElement, HTMLButtonElement>();
  let open: HTMLElement | null = null;
  const show = (target: HTMLElement | null): void => {
    open = target;
    for (const [aid, button] of buttons) {
      aid.hidden = aid !== target;
      button.setAttribute("aria-expanded", String(aid === target));
    }
    drawer.hidden = target === null;
    host.classList.toggle("has-drawer", target !== null);
  };

  for (const aid of aids) {
    const kind = kindOf(aid);
    const label = t(kind, kind);
    const note = kind === "heuristic" ? ` · ${t("notRigorous", "not rigorous")}` : "";

    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "lens-dot";
    dot.dataset.aid = kind;
    dot.dataset.label = label;
    dot.setAttribute("aria-label", label + note);
    dot.addEventListener("click", () => show(open === aid ? null : aid));
    buttons.set(aid, dot);
    dots.append(dot);

    // The panel names itself (the dots are unlabelled) and closes from its own header.
    aid.classList.add("lens-panel");
    aid.dataset.aid = kind;
    const head = document.createElement("div");
    head.className = "lens-head";
    const name = document.createElement("span");
    name.className = "lens-name";
    name.textContent = label;
    if (note) {
      const em = document.createElement("span");
      em.className = "aid-note";
      em.textContent = note;
      name.append(em);
    }
    const close = document.createElement("button");
    close.type = "button";
    close.className = "lens-close";
    close.setAttribute("aria-label", t("close", "Close"));
    close.textContent = "\u00d7"; // ×
    close.addEventListener("click", () => {
      show(null);
      dot.focus();
    });
    head.append(name, close);
    aid.prepend(head);
    drawer.append(aid);
  }

  const inPreview = host.closest(".xref-pop-body") !== null;
  show(inPreview ? null : aids.find((a) => a.getAttribute("collapsed") === "false") ?? null);
  return { dots, drawer };
}

/** An aid outside a result box: a labelled block ("Heuristic · not rigorous") that folds. */
class DeltaAid extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    if (this.classList.contains("lens-panel")) return; // already placed on a lens

    const kind = kindOf(this);
    this.classList.add("aid");
    const label = document.createElement("span");
    label.className = "aid-label";
    label.textContent = t(kind, kind);
    if (kind === "heuristic") {
      const note = document.createElement("span");
      note.className = "aid-note";
      note.textContent = t("notRigorous", "not rigorous");
      label.append(" · ", note);
    }
    this.prepend(label);
    applyCollapsible(this, label);
  }
}

export function defineAids(): void {
  for (const kind of AIDS) customElements.define(`delta-${kind}`, class extends DeltaAid {});
}
