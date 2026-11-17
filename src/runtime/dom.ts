/**
 * Small DOM builders and readers several elements share: what tag an element came from, a
 * button, a title taken out with its math intact, a caption prefix, a meta row, a copy button.
 * Keep a helper that only one element uses next to that element.
 */

import { nameOf, t } from "./i18n.ts";

/** `delta-theorem` → `theorem`: the Delta tag an element came from. */
export function kindOf(el: Element): string {
  return el.tagName.toLowerCase().replace(/^delta-/, "");
}

/** A `<button type="button">` with a class and its content (text or nodes). */
export function button(className: string, ...content: (Node | string)[]): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  if (className) b.className = className;
  b.append(...content);
  return b;
}

/**
 * Takes the host's `<delta-title>` out of it, returning its child nodes (math and emphasis
 * intact, to move into the element's own chrome) and the text a screen reader should hear.
 * Undefined when the host has no title.
 */
export function takeTitle(host: Element): { nodes: Node[]; text: string } | undefined {
  const title = host.querySelector(":scope > delta-title");
  if (!title) return undefined;
  const text = spokenText(title);
  const nodes = [...title.childNodes];
  title.remove();
  return { nodes, text };
}

/**
 * The text a screen reader should hear for `el`. KaTeX renders each formula three times
 * (MathML, a TeX annotation, the visual HTML); only the MathML reading is kept. Anything
 * marked `aria-hidden="true"` (an icon, a decorative emoji) is left out too.
 */
export function spokenText(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const dup of copy.querySelectorAll('.katex-html, annotation, [aria-hidden="true"]'))
    dup.remove();
  return copy.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

/** A caption prefix: the localized name of `kind` and its number ("Figure 1.2", "Table 3"). */
export function numberedName(kind: string, num: string | null): string {
  return nameOf(kind) + (num ? ` ${num}` : "");
}

/**
 * Renders the host's `<delta-meta>` (a list of `<delta-meta-item key="…">value</delta-meta-item>`)
 * as a `.box-meta` row of key/value pairs, in its place. Returns the row, so a caller can
 * move it (a box puts it at the bottom); null when there is nothing to show.
 */
export function renderMeta(host: Element): HTMLElement | null {
  const meta = host.querySelector(":scope > delta-meta");
  if (!meta) return null;
  const row = document.createElement("div");
  row.className = "box-meta";
  for (const item of meta.querySelectorAll(":scope > delta-meta-item")) {
    const key = item.getAttribute("key");
    if (!key || !item.textContent?.trim()) continue;
    const k = document.createElement("span");
    k.className = "k";
    k.textContent = key;
    const v = document.createElement("span");
    v.className = "v";
    v.append(...item.childNodes); // the gap after the key is `.k`'s margin
    const pair = document.createElement("span");
    pair.className = "box-meta-item";
    pair.append(k, v);
    row.append(pair);
  }
  if (!row.childElementCount) {
    meta.remove();
    return null;
  }
  meta.replaceWith(row);
  return row;
}

/** A "Copy" button that puts `text()` on the clipboard and says "Copied" for a moment. */
export function copyButton(
  className: string,
  label: string,
  text: () => string,
): HTMLButtonElement {
  const copy = button(className, label);
  copy.addEventListener("click", () => {
    void navigator.clipboard?.writeText(text()).then(() => {
      copy.textContent = t("copied", "Copied");
      copy.classList.add("is-copied");
      setTimeout(() => {
        copy.textContent = label;
        copy.classList.remove("is-copied");
      }, 1400);
    });
  });
  return copy;
}
