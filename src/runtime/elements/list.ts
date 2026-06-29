/**
 * <list> / <item> — ordered & unordered lists. The compiler passes the tags
 * through untouched; this element converts them into semantic <ol>/<ul>/<li> and
 * tags the marker style (`data-marker`) so list.css can draw Delta-styled markers
 * with CSS counters (accent ink, tabular figures, tidy gutter) — things native
 * `::marker` can't do. Lists nest: an inner <list> inside an <item> upgrades on
 * its own, so each level keeps its own numbering.
 *
 *   <list>…</list>                    → bullets (unordered)
 *   <list marker="number">…</list>    → 1. 2. 3.
 *   <list marker="alpha">…</list>     → a. b. c.    (marker="A" → A. B. C.)
 *   <list marker="roman">…</list>     → i. ii. iii. (marker="I" → I. II. III.)
 *   <list marker="dash">…</list>      → – – –
 *   <list marker="number" start="3">  → numbering begins at 3
 *
 * `numbered="true"` is kept as a legacy alias for marker="number".
 */

interface MarkerSpec {
  ordered: boolean;
  /** the `data-marker` value list.css keys its counter/glyph off. */
  marker: string;
}

const BULLET: MarkerSpec = { ordered: false, marker: "bullet" };

/** Author marker name → resolved spec. Keys are matched case-sensitively first
 *  (so "a"/"A" and "i"/"I" pick lower vs upper), then lowercased as a fallback. */
const MARKERS: Record<string, MarkerSpec> = {
  // ordered — numbers
  "1": { ordered: true, marker: "decimal" },
  number: { ordered: true, marker: "decimal" },
  numbers: { ordered: true, marker: "decimal" },
  numbered: { ordered: true, marker: "decimal" },
  decimal: { ordered: true, marker: "decimal" },
  // ordered — letters
  a: { ordered: true, marker: "alpha" },
  alpha: { ordered: true, marker: "alpha" },
  alphabetical: { ordered: true, marker: "alpha" },
  A: { ordered: true, marker: "alpha-upper" },
  "alpha-upper": { ordered: true, marker: "alpha-upper" },
  // ordered — roman
  i: { ordered: true, marker: "roman" },
  roman: { ordered: true, marker: "roman" },
  I: { ordered: true, marker: "roman-upper" },
  "roman-upper": { ordered: true, marker: "roman-upper" },
  // unordered
  bullet: BULLET,
  disc: BULLET,
  dot: BULLET,
  dash: { ordered: false, marker: "dash" },
  none: { ordered: false, marker: "none" },
};

function resolveMarker(el: Element): MarkerSpec {
  if (el.getAttribute("numbered") === "true") return MARKERS.number;
  const raw = (el.getAttribute("marker") ?? "").trim();
  if (!raw) return BULLET;
  return MARKERS[raw] ?? MARKERS[raw.toLowerCase()] ?? BULLET;
}

class DeltaList extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    this._render();
  }

  _render(): void {
    const spec = resolveMarker(this);
    const listEl = document.createElement(spec.ordered ? "ol" : "ul");
    listEl.className = "delta-list";
    listEl.dataset.marker = spec.marker;

    // `start="N"` on an ordered list (set the counter to N-1; first item lands on
    // N). Inline counter-reset, not a custom prop — custom props inherit and would
    // leak the offset into nested lists.
    if (spec.ordered) {
      const start = parseInt(this.getAttribute("start") ?? "", 10);
      if (Number.isFinite(start)) {
        listEl.style.counterReset = `delta-item ${start - 1}`;
        listEl.setAttribute("start", String(start)); // keep <ol> semantics in sync
      }
    }

    // Each direct <item> becomes a real <li>; a nested <list> rides along inside an
    // item's children and upgrades itself once reconnected.
    this.querySelectorAll(":scope > delta-item").forEach((item) => {
      const li = document.createElement("li");
      li.className = "delta-list-item";
      // Carry reveal fragment attributes onto the real <li> so a list item can be a
      // deck fragment (the controller queries the rendered element, not <delta-item>).
      for (const attr of ["reveal", "reveal-order"]) {
        const v = item.getAttribute(attr);
        if (v !== null) li.setAttribute(attr, v);
      }
      li.append(...item.childNodes);
      listEl.append(li);
    });

    this.replaceChildren(listEl);
  }
}

export function defineList(): void {
  customElements.define("delta-list", DeltaList);
}
