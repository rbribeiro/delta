/**
 * <change> — a tracked change, the "what did the agent actually write?" view:
 *
 *   <change by="claude" date="2026-09-12" note="sign was reversed">
 *     <old>$x < 0$</old><new>$x > 0$</new>
 *   </change>                                       replace
 *   <change by="claude">an inserted sentence.</change>   insert (bare content)
 *   <change by="claude"><old>a removed one.</old></change>   delete
 *
 * The compiler infers `kind` (insert | delete | replace) and `block="true"` when the
 * change wraps block content (a lemma, a proof…); this element normalizes the DOM to
 * one shape — `<delta-old class="chg-del">` / `<delta-new class="chg-ins">` inside the
 * host — adds a numbered `.chg-marker` whose popover shows author, date, kind and note,
 * and leaves the rest to CSS. Three document-wide views, switched from the <review>
 * panel via `window.Delta.review.setChanges(...)` and read by change.css:
 *
 *   html[data-changes="markup"]    both sides, marked up (default)
 *   html[data-changes="final"]     new text only, unmarked — what the paper will say
 *   html[data-changes="original"]  old text only — what it said before
 *
 * Accepting a change for real means editing the source (or building with --final).
 */

import { t } from "../i18n";
import { popover } from "../utils";
import { memberChip, memberColor } from "./collab";

class DeltaChange extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const by = this.getAttribute("by");
    const kind = this.getAttribute("kind") ?? "insert";
    const num = this.getAttribute("num");
    const color = memberColor(by);

    this.classList.add("chg");
    this.dataset.kind = kind;
    if (this.getAttribute("block") === "true") this.classList.add("chg-block");
    if (color) this.setAttribute("data-accent", color);

    // One shape: a bare insertion gets wrapped in a <delta-new> like an explicit one.
    const olds = [...this.querySelectorAll(":scope > delta-old")];
    let news = [...this.querySelectorAll(":scope > delta-new")];
    if (olds.length === 0 && news.length === 0) {
      const n = document.createElement("delta-new");
      n.append(...this.childNodes);
      this.append(n);
      news = [n];
    }
    for (const o of olds) o.classList.add("chg-del");
    for (const n of news) n.classList.add("chg-ins");

    // Marker + popover (author, date, kind, note).
    const label = `${t("change", "Change")}${num ? ` ${num}` : ""} · ${t(kind, kind)}`;
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "chg-marker";
    marker.textContent = num ?? "Δ"; // Δ
    marker.title = label;
    marker.setAttribute("aria-label", label);
    marker.addEventListener("click", (e) => e.stopPropagation());
    marker.addEventListener("keydown", (e) => e.stopPropagation());

    const pop = document.createElement("div");
    pop.className = "chg-pop";
    if (color) pop.setAttribute("data-accent", color);
    const head = document.createElement("div");
    head.className = "chg-pop-head";
    const chip = memberChip(by);
    if (chip) head.append(chip);
    const date = this.getAttribute("date");
    if (date) {
      const d = document.createElement("span");
      d.className = "chg-date";
      d.textContent = date;
      head.append(d);
    }
    const kindEl = document.createElement("span");
    kindEl.className = "chg-kind";
    kindEl.dataset.kind = kind;
    kindEl.textContent = t(kind, kind);
    head.append(kindEl);
    pop.append(head);
    const note = this.getAttribute("note");
    if (note) {
      const n = document.createElement("div");
      n.className = "chg-note";
      n.textContent = note;
      pop.append(n);
    }

    this.prepend(marker);
    popover(marker, pop);
  }
}

export function defineChange(): void {
  customElements.define("delta-change", class extends DeltaChange {});
}
