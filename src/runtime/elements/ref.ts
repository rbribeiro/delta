/**
 * <ref to="id"> — a cross-reference. The compiler resolved the target's number
 * (`data-target-num`) and kind (`data-target-tag`), so the link reads "Theorem 1.1" (localized via `t`)
 * unless the author supplied their own text. Clicking opens a `.delta-pop` card
 * previewing the target — cloned from the inert `<template data-delta-pop="id">`
 * the emitter shipped, so no fetch — with a button that jumps to it and flashes
 * it. An unresolved ref (no `data-target-num`/`data-target-tag`) is left as inert text.
 */

import { t } from "../i18n";
import { popover } from "../utils";

// Small "jump to" arrow for the pop-over's go-to button (sized by reference.css).
const XREF_GO_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>';

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

    const label = `${t(kind, kind.charAt(0).toUpperCase() + kind.slice(1))} ${num}`;

    // The clickable link: the author's own text if any, else the composed label.
    const hasText = (this.textContent ?? "").trim().length > 0;
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "xref";
    if (hasText) trigger.append(...this.childNodes);
    else trigger.textContent = label;
    this.replaceChildren(trigger);

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
      if(window.Delta?.deck?.goToId(to)) return; // in a deck, page to the target's slide
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
}

export function defineRef(): void {
  customElements.define("delta-ref", class extends DeltaRef {});
}
