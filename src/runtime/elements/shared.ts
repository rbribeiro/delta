/**
 * Cross-element runtime helpers shared by more than one component. Keep
 * single-component helpers next to their element.
 */

import { nameOf, t } from "../i18n";
import { memberChip } from "./collab";

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

// -- jumping to a target ------------------------------------------------------

/** Unfolds, smooth-scrolls to and flashes `#id` (the shared `.is-xref-target` animation). */
export function flashTarget(id: string, block: ScrollLogicalPosition = "center"): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  unfoldAncestors(target);
  target.scrollIntoView({ block, behavior: "smooth" });
  target.classList.add("is-xref-target");
  target.addEventListener("animationend", () => target.classList.remove("is-xref-target"), {
    once: true,
  });
  return true;
}

/**
 * Jumps to `#id` in this page the way every Delta link does: in a deck, pages to the
 * target's slide; otherwise unfolds, scrolls and flashes it. False when there is no such
 * element (the caller can then let the browser try).
 */
export function jumpTo(id: string, block: ScrollLogicalPosition = "center"): boolean {
  if (window.Delta?.deck?.goToId(id)) return true;
  return flashTarget(id, block);
}

/**
 * Makes a link (its `href` already `file#id` or `#id`) jump like every Delta link: to
 * another output (`file` set) the browser navigates; in-page it is `jumpTo`. `before`
 * runs first on every click (closing the pop-over the link sits in).
 */
export function linkJump(
  a: HTMLAnchorElement,
  id: string,
  file?: string | null,
  { block = "center", before }: { block?: ScrollLogicalPosition; before?: () => void } = {},
): void {
  a.addEventListener("click", (e) => {
    before?.();
    if (file) return;
    if (jumpTo(id, block)) e.preventDefault();
  });
}

/** The inert `<template data-delta-pop="id">` snapshot the compiler shipped for `id`. */
export function templateFor(id: string): HTMLTemplateElement | undefined {
  templates ??= new Map(
    [...document.querySelectorAll<HTMLTemplateElement>("template[data-delta-pop]")].map((tpl) => [
      tpl.dataset.deltaPop ?? "",
      tpl,
    ]),
  );
  return templates.get(id);
}
let templates: Map<string, HTMLTemplateElement> | undefined;

// -- labels and titles --------------------------------------------------------

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
 * (MathML, a TeX annotation, the visual HTML); only the MathML reading is kept.
 */
export function spokenText(el: Element): string {
  const copy = el.cloneNode(true) as Element;
  for (const dup of copy.querySelectorAll(".katex-html, annotation")) dup.remove();
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

// -- folding --------------------------------------------------------------------

/**
 * Folds or unfolds a host `applyCollapsible` wired, keeping its toggle's `aria-expanded` in
 * step. For controls that fold many hosts at once (the proof's step levels).
 */
export function setFolded(host: Element, folded: boolean): void {
  host.classList.toggle("is-collapsed", folded);
  host.querySelector(":scope > .collapse-toggle")?.setAttribute("aria-expanded", String(!folded));
}

/** Unfolds every folded ancestor of `el`, so a jump to a step inside a folded proof lands on it. */
export function unfoldAncestors(el: Element): void {
  for (
    let at = el.parentElement?.closest(".is-collapsed");
    at;
    at = at.parentElement?.closest(".is-collapsed")
  ) {
    setFolded(at, false);
  }
}

/**
 * Formats a `<delta-paper>` into an inline reference fragment ("Author. Title.
 * Journal. Year." + an optional link), cloning each field's children so the
 * source node is left intact. Shared by the bibliography list and the citation
 * hovercard. Math/emphasis inside a field survive (childNodes are cloned, not
 * flattened to text).
 */
export function formatPaper(paper: Element): DocumentFragment {
  const frag = document.createDocumentFragment();
  const field = (name: string): Element | null => paper.querySelector(`:scope > delta-${name}`);

  const present = ["author", "title", "journal", "year"]
    .map(field)
    .filter((el): el is Element => el !== null);

  present.forEach((el, i) => {
    if (i > 0) frag.append(". ");
    const span = document.createElement("span");
    span.className = `paper-${kindOf(el)}`;
    for (const node of el.childNodes) span.append(node.cloneNode(true));
    frag.append(span);
  });
  if (present.length) frag.append(".");

  // A trailing <link>/<url> rides through as a real link (DeltaLink upgrades it).
  const link = field("link") ?? field("url");
  if (link) {
    frag.append(" ");
    frag.append(link.cloneNode(true));
  }
  return frag;
}

/**
 * Makes `host` collapsible when it carries `collapsible="true"` (or
 * `collapsed="true"`). The `label` (a heading, box tag, or proof lead) becomes the
 * disclosure toggle; the label's following siblings — the body, loose text and all
 * — move into a `.collapse-body` so they hide as one. Clicking or pressing
 * Enter/Space folds the host (`.is-collapsed`); the caret + hide live in collapse.css.
 */
export function applyCollapsible(host: HTMLElement, label: HTMLElement): void {
  const collapsed = host.getAttribute("collapsed") === "true";
  if (!collapsed && host.getAttribute("collapsible") !== "true") return;

  const body = document.createElement("div");
  body.className = "collapse-body";
  while (label.nextSibling) body.append(label.nextSibling);
  host.append(body);

  label.classList.add("collapse-toggle");
  label.setAttribute("role", "button");
  label.tabIndex = 0;

  const apply = (c: boolean): void => setFolded(host, c);
  apply(collapsed);

  const flip = (): void => apply(!host.classList.contains("is-collapsed"));
  label.addEventListener("click", flip);
  label.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip();
    }
  });
}

/**
 * Status / authorship chrome for any block carrying `status` (draft | sketch | review |
 * verified), `by` (who wrote it) or `verified-by` (who checked it): environments, proofs,
 * sections, `<draft>`. Appends a `.status-pill` — the localized status, the author chip, a
 * "✓ verified by" chip — to the block's `label` (box tag, proof lead, heading); with no
 * label it prepends a `.status-bar` row instead. Sets `data-status` on the host so the CSS
 * can tint an unfinished block. A no-op when none of the three attributes is present, so
 * every existing document renders exactly as before.
 */
export function applyStatus(host: HTMLElement, label: Element | null): void {
  const status = host.getAttribute("status");
  const by = host.getAttribute("by");
  const verifiedBy = host.getAttribute("verified-by");
  if (!status && !by && !verifiedBy) return;
  if (status) host.dataset.status = status;

  const pill = document.createElement("span");
  pill.className = "status-pill";
  if (status) {
    pill.dataset.status = status;
    const s = document.createElement("span");
    s.className = "status-label";
    s.textContent = t(status, status);
    pill.append(s);
  }
  const byChip = memberChip(by);
  if (byChip) pill.append(byChip);
  const vChip = memberChip(verifiedBy);
  if (vChip) {
    const check = document.createElement("span");
    check.className = "status-check";
    check.title = t("verifiedBy", "verified by");
    check.textContent = "\u2713"; // ✓
    pill.append(check, vChip);
  }

  if (label) {
    label.append(" ", pill);
  } else {
    const bar = document.createElement("div");
    bar.className = "status-bar";
    bar.append(pill);
    host.prepend(bar);
  }
}
