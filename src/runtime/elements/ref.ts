/**
 * <ref to="id"> — a cross-reference. The compiler resolved the target's number
 * (`data-target-num`) and kind (`data-target-tag`), so the link reads "Theorem 1.1" (localized via `t`)
 * unless the author supplied their own text. Clicking opens a `.delta-pop` card
 * previewing the target — cloned from the inert `<template data-delta-pop="id">`
 * the emitter shipped, so no fetch — with a button that jumps to it and flashes
 * it. An unresolved ref (no `data-target-num`/`data-target-tag`) is left as inert text.
 *
 * The card/popover/jump wiring is shared (`wireRefPopover`) with `wireMathRefs`,
 * which upgrades the `\htmlData` marker spans the compiler bakes into KaTeX
 * output for `\ref{id}` / `\eqref{id}` — the same behavior, inside math.
 */

import { t } from "../i18n";
import { popover } from "../utils";

// Small "jump to" arrow for the pop-over's go-to button (sized by reference.css).
const XREF_GO_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';

interface RefTarget {
  to: string;
  num: string;
  kind: string;
  /** Set when the target lives in another output file (project path). */
  href?: string | null;
}

/**
 * Wires a trigger element with the <ref> behavior: a preview card filled lazily
 * from the target's `<template data-delta-pop>` snapshot, and a go-to button that
 * pages the deck / navigates cross-file / scrolls-and-flashes in-page.
 */
export function wireRefPopover(trigger: HTMLElement, { to, num, kind, href }: RefTarget): void {
  const label = `${t(kind, kind.charAt(0).toUpperCase() + kind.slice(1))} ${num}`;

  // The preview card, filled lazily from the snapshot on first open.
  const card = document.createElement("div");
  card.className = "xref-pop";
  const head = document.createElement("div");
  head.className = "xref-pop-head";
  const labelEl = document.createElement("span");
  labelEl.className = "xref-pop-label";
  labelEl.textContent = label;
  const go = document.createElement("button");
  go.type = "button";
  go.className = "xref-go";
  go.title = label;
  go.setAttribute("aria-label", label);
  go.innerHTML = XREF_GO_ICON;
  head.append(labelEl, go);
  const cardBody = document.createElement("div");
  cardBody.className = "xref-pop-body";
  card.append(head, cardBody);

  let filled = false;
  const pop = popover(trigger, card, {
    onOpen: () => {
      if (filled) return;
      filled = true;
      const tpl = [...document.querySelectorAll("template[data-delta-pop]")].find(
        (el) => (el as HTMLTemplateElement).dataset.deltaPop === to,
      ) as HTMLTemplateElement | undefined;
      if (!tpl) return;
      const clone = tpl.content.cloneNode(true) as DocumentFragment;
      // Drop ids (the original keeps them — the go-to target) and unfold any
      // collapsed target so the preview shows in full.
      for (const el of clone.querySelectorAll("[id]")) el.removeAttribute("id");
      for (const el of clone.querySelectorAll("[collapsed], [collapsible]")) {
        el.removeAttribute("collapsed");
        el.removeAttribute("collapsible");
      }
      cardBody.append(clone);
    },
  });

  go.addEventListener("click", (e) => {
    e.preventDefault();
    pop.close();
    if (window.Delta?.deck?.goToId(to)) return; // in a deck, page to the target's slide
    if (href) {
      location.href = href; // cross-file: navigate to the target's output (#id flashes on arrival)
      return;
    }
    const target = document.getElementById(to);
    if (!target) return;
    target.scrollIntoView({ block: "center", behavior: "smooth" });
    target.classList.add("is-xref-target");
    target.addEventListener("animationend", () => target.classList.remove("is-xref-target"), {
      once: true,
    });
  });
}

class DeltaRef extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const to = this.getAttribute("to") ?? "";
    const num = this.getAttribute("data-target-num");
    const kind = this.getAttribute("data-target-tag");
    // Set on the project path when the target lives in another output file.
    const href = this.getAttribute("data-target-href");
    if (!kind || !num) return; // unresolved: the compiler warned; leave it as bare text

    // The clickable link: the author's own text if any, else the composed label.
    const hasText = (this.textContent ?? "").trim().length > 0;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "xref";
    if (hasText) trigger.append(...this.childNodes);
    else trigger.textContent = `${t(kind, kind.charAt(0).toUpperCase() + kind.slice(1))} ${num}`;
    this.replaceChildren(trigger);

    wireRefPopover(trigger, { to, num, kind, href });
  }
}

/**
 * Upgrades the in-math \ref markers: the compiler expands `\ref{id}` into a
 * `\htmlData{delta-ref-to=…, delta-ref-num=…, delta-ref-tag=…}` span inside the
 * KaTeX output; this scan makes each one a keyboard-reachable trigger with the
 * same popover/jump as <ref>. Runs once at load — template snapshots are inert
 * fragments (never matched here), so a \ref inside a popover *clone* shows its
 * number but isn't clickable, which is fine for a preview.
 */
export function wireMathRefs(): void {
  for (const span of document.querySelectorAll<HTMLElement>(".katex [data-delta-ref-to]")) {
    const { deltaRefTo: to, deltaRefNum: num, deltaRefTag: kind, deltaRefHref: href } =
      span.dataset;
    if (!to || !num || !kind) continue;
    span.classList.add("math-xref");
    span.setAttribute("role", "link");
    span.tabIndex = 0;
    span.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        span.click();
      }
    });
    wireRefPopover(span, { to, num, kind, href });
  }
}

export function defineRef(): void {
  customElements.define("delta-ref", class extends DeltaRef {});
}
