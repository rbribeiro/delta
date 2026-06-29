/**
 * <toc> — a table of contents. Reads the compile-time heading tree from the
 * `#delta-toc` island and builds a nested nav of links. `depth` (default 2 —
 * down to subsections; chapters always shown) limits how deep it goes:
 * `level - 1 <= depth`, where section = 2 … subsubsection = 4. Clicking an entry
 * smooth-scrolls to the section and flashes it (shared `.is-xref-target`).
 *
 * In a multi-file project the island is the whole book's heading list, each entry
 * carrying a `file` unless it lives in *this* output. `scope` chooses what to show:
 * `scope="project"` lists everything (cross-file entries link to their output and
 * navigate there); the default lists only this file's own entries (no `file`).
 */

import { t } from "../i18n";

interface TocItem {
  level: number;
  id: string;
  num: string;
  title: string;
  /** Set on a project entry whose section lives in another output file. */
  file?: string;
}

// The #delta-toc JSON island, parsed once (mirrors i18n's strings() cache).
let tocCache: TocItem[] | null = null;
function readTocData(): TocItem[] {
  if (tocCache) return tocCache;
  const el = document.getElementById("delta-toc");
  try {
    tocCache = el ? (JSON.parse(el.textContent || "[]") as TocItem[]) : [];
  } catch {
    tocCache = [];
  }
  return tocCache;
}

class DeltaToc extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const depth = parseInt(this.getAttribute("depth") ?? "2", 10);
    // scope="project" lists the whole book; the default lists only this file's own
    // entries (those the compiler left without a `file` tag).
    const projectScope = this.getAttribute("scope") === "project";
    const entries = readTocData().filter(
      (e) => e.level - 1 <= depth && (projectScope || !e.file),
    );
    if (entries.length === 0) return;

    const nav = document.createElement("nav");
    nav.className = "toc";
    const title = this.querySelector(":scope > delta-title");
    const heading = title ? title.innerHTML :t("contents", "Contents");
    nav.setAttribute("aria-label", heading);
    const titleEl = document.createElement("div");
    titleEl.className = "toc-title";
    titleEl.innerHTML = heading;
    nav.append(titleEl);

    const root = document.createElement("ol");
    root.className = "toc-list";
    // Build the nesting from the flat level sequence with a level-stack. `root`
    // holds the shallowest level present (the first entry's level), so a
    // chapter-less article — every heading a sibling <section> — lays out flat
    // instead of cascading deeper with each entry.
    const stack: { level: number; ol: HTMLOListElement }[] = [
      { level: entries[0].level, ol: root },
    ];

    for (const e of entries) {
      // Pop back up to the list that holds this level …
      while (stack.length > 1 && e.level < stack[stack.length - 1].level) stack.pop();
      let top = stack[stack.length - 1];
      // … then open a nested list under the previous item when going deeper.
      if (e.level > top.level) {
        const lastLi = top.ol.lastElementChild;
        const sub = document.createElement("ol");
        sub.className = "toc-sub";
        (lastLi ?? top.ol).append(sub);
        stack.push({ level: e.level, ol: sub });
        top = stack[stack.length - 1];
      }

      const li = document.createElement("li");
      li.className = "toc-item";
      const a = document.createElement("a");
      a.className = "toc-link";
      a.href = e.file ? `${e.file}#${e.id}` : `#${e.id}`;
      if (e.num) {
        const numEl = document.createElement("span");
        numEl.className = "toc-num";
        numEl.textContent = e.num;
        a.append(numEl, " ");
      }
      const text = document.createElement("span");
      text.className = "toc-text";
      text.innerHTML = e.title; // our own serialized inline content (keeps math)
      a.append(text);
      a.addEventListener("click", (ev) => {
        if (e.file) return; // cross-file: let the browser navigate (arrival flash handles it)
        const target = document.getElementById(e.id);
        if (!target) return;
        ev.preventDefault();
        target.scrollIntoView({ block: "start", behavior: "smooth" });
        target.classList.add("is-xref-target");
        target.addEventListener("animationend", () => target.classList.remove("is-xref-target"), {
          once: true,
        });
      });
      li.append(a);
      top.ol.append(li);
    }

    nav.append(root);
    this.replaceChildren(nav);
  }
}

export function defineToc(): void {
  customElements.define("delta-toc", class extends DeltaToc {});
}
