/**
 * <table> — a data table for presenting datasets. The compiler passes the tags
 * through untouched; this element reads its own children and builds a real
 * <table class="t"> wrapped in <div class="table-wrap">, inheriting the polished,
 * token-based look already defined in base.css (borders, padding, tabular figures,
 * uppercase sans header). Only the head block + sticky header are net-new chrome
 * (components/table.css).
 *
 *   <table max-height="420px">              → rows scroll inside 420px; header freezes
 *     <title>…</title>                      → prominent title above the table
 *     <caption>…</caption>                  → muted description above the table
 *     <header>                              → <thead>
 *       <column>Name</column>               → a column name (<th>)
 *       <column align="right">Reqs/s</column>
 *     </header>
 *     <row>                                 → <tbody> row
 *       <column>A</column>                  → a cell (<td>)
 *       <column align="right">1240</column>
 *     </row>
 *   </table>
 *
 * `<column>` is the cell tag in both <header> and <row>. Alignment set on a header
 * column becomes that column's default; body cells inherit it by index and may
 * override with their own `align`. `align="right"` reuses base `.num` (right +
 * tabular numerals); `mono="true"` reuses base `.mono`. Cell content moves as
 * childNodes, so inline math/links/emphasis survive.
 */

import { t } from "../i18n";

/** Applies a cell's alignment / mono style, reusing the base `.num` and `.mono`
 *  helpers. Header columns seed `aligns[i]`; body cells fall back to it. */
function applyCell(
  cell: HTMLTableCellElement,
  src: Element,
  index: number,
  aligns: string[],
  isHeader: boolean,
): void {
  let align = src.getAttribute("align");
  if (isHeader && align) aligns[index] = align;
  if (!align) align = aligns[index];

  if (align === "right")
    cell.classList.add("num"); // base .num: right-align + tabular figures
  else if (align === "center") cell.style.textAlign = "center";

  if (src.getAttribute("mono") === "true") cell.classList.add("mono"); // base .mono
}

class DeltaTable extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    this.classList.add("delta-table");

    // Head block — title + caption, with an optional "Table N" eyebrow.
    const titleEl = this.querySelector(":scope > delta-title");
    const capEl = this.querySelector(":scope > delta-caption");
    const num = this.getAttribute("num");
    let head: HTMLElement | null = null;
    if (titleEl || capEl || num) {
      head = document.createElement("div");
      head.className = "table-head";
      if (titleEl || num) {
        const lbl = document.createElement("span");
        lbl.className = "table-lbl";
        lbl.textContent = t("table", "Table") + (num ? ` ${num}` : "");
        head.append(lbl);
      }
      if (titleEl) {
        const ttl = document.createElement("span");
        ttl.className = "table-title";
        ttl.append(...titleEl.childNodes);
        head.append(ttl);
      }
      if (capEl) {
        const cap = document.createElement("span");
        cap.className = "table-cap";
        cap.append(...capEl.childNodes);
        head.append(cap);
      }
    }

    const table = document.createElement("table");
    table.className = "t";

    // Per-column alignment defaults, seeded by the header and inherited by body cells.
    const aligns: string[] = [];

    const header = this.querySelector(":scope > delta-header");
    if (header) {
      const thead = document.createElement("thead");
      const tr = document.createElement("tr");
      header.querySelectorAll(":scope > delta-column").forEach((col, i) => {
        const th = document.createElement("th");
        applyCell(th, col, i, aligns, true);
        th.append(...col.childNodes);
        tr.append(th);
      });
      thead.append(tr);
      table.append(thead);
    }

    const tbody = document.createElement("tbody");
    this.querySelectorAll(":scope > delta-row").forEach((row) => {
      const tr = document.createElement("tr");
      row.querySelectorAll(":scope > delta-column").forEach((cell, i) => {
        const td = document.createElement("td");
        applyCell(td, cell, i, aligns, false);
        td.append(...cell.childNodes);
        tr.append(td);
      });
      tbody.append(tr);
    });
    table.append(tbody);

    // Scroll wrapper. A `max-height` turns it into a vertical scroller, so the
    // sticky header (components/table.css) freezes at its top.
    const wrap = document.createElement("div");
    wrap.className = "table-wrap";
    const maxHeight = this.getAttribute("max-height");
    if (maxHeight) {
      wrap.style.maxHeight = maxHeight;
      wrap.style.overflowY = "auto";
    }
    wrap.append(table);

    this.replaceChildren(...(head ? [head] : []), wrap);
  }
}

export function defineTable(): void {
  customElements.define("delta-table", DeltaTable);
}
