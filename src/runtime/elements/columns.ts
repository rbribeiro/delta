/**
 * <columns> — side-by-side layout (LaTeX/beamer style). A flex container whose
 * direct <column> children sit in a row; each column picks its share with a
 * `width` attribute:
 *
 *   <columns>
 *     <column width="2"> … </column>   →  two-thirds (weight 2 of 3)
 *     <column width="1"> … </column>   →  one-third
 *   </columns>
 *
 * `width` is read here and published as a `--col-flex` custom property on each
 * column (components/columns.css consumes it via `flex: var(--col-flex, 1 1 0)`):
 *   - a unitless number (or `fr`)  → a flex weight, e.g. width="2" ⇒ `2 1 0`.
 *     Proportions and LaTeX-style fractions both work (0.6 + 0.4 ⇒ 60/40).
 *   - a CSS length / percentage    → a fixed basis, e.g. width="240px" ⇒ `0 1 240px`.
 *   - omitted                      → equal share (the CSS default).
 *
 * Only `delta-columns` is a registered element, and it touches **only its own
 * direct `delta-column` children** (`:scope > delta-column`). A table cell is also
 * a `<column>`, but it lives under `<row>`/`<header>` inside `<table>` — never a
 * direct child of `<columns>` — so the two `<column>` uses never collide. The CSS
 * is scoped the same way (`delta-columns > delta-column`).
 */

const NUMERIC = /^\d*\.?\d+(fr)?$/; // "2", "0.6", ".5", "2fr"

class DeltaColumns extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const gap = this.getAttribute("gap");
    if (gap) this.style.gap = gap;

    for (const col of this.querySelectorAll<HTMLElement>(":scope > delta-column")) {
      const w = col.getAttribute("width");
      if (!w) continue; // no width → CSS default (equal share)
      const flex = NUMERIC.test(w.trim())
        ? `${parseFloat(w)} 1 0` // unitless / fr → weight
        : `0 1 ${w}`; // length or % → fixed basis, may shrink, won't grow
      col.style.setProperty("--col-flex", flex);
    }
  }
}

export function defineColumns(): void {
  customElements.define("delta-columns", DeltaColumns);
}
