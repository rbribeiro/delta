/**
 * <cite> — a numeric citation. The compiler resolved the parallel
 * `data-cite-nums` / `data-cite-ids` lists (e.g. "1,3" / "ARS10,KL98"), so this
 * renders an inline "[1, 3]". Clicking the citation only opens a `.cite-pop`
 * hovercard (built on the shared `.delta-pop`) listing each cited paper — cloned
 * from the inert `<template data-delta-pop="id">` the emitter shipped, so no
 * fetch. Jumping to an entry happens only when its `.cite-pop-num` link inside the
 * card is clicked (which also closes the card), mirroring `<ref>`'s go-to button.
 * A cite whose ids were all unknown stays inert.
 */

import { popover } from "../utils";
import { flashTarget, formatPaper } from "./shared";

class DeltaCite extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const nums = (this.getAttribute("data-cite-nums") ?? "").split(",").filter(Boolean);
    const ids = (this.getAttribute("data-cite-ids") ?? "").split(",").filter(Boolean);
    // Set on the project path when the references list lives in another output file.
    const citeFile = this.getAttribute("data-cite-file");
    if (nums.length === 0) {
      this.classList.add("cite-missing"); // unresolved: leave the author text as-is
      return;
    }

    // Inline "[1, 3]" — the whole span is the popover trigger; the numbers do not
    // navigate on their own (jumping is done from inside the card).
    const cite = document.createElement("span");
    cite.className = "cite";
    cite.append("[");
    nums.forEach((num, i) => {
      if (i > 0) cite.append(", ");
      const a = document.createElement("a");
      a.textContent = num; // styled by .cite a; no href — opening is the trigger's job
      cite.append(a);
    });
    cite.append("]");
    this.replaceChildren(cite);

    // Hovercard: one .cite-pop-item per cited paper, filled lazily on first open.
    const card = document.createElement("div");
    card.className = "cite-pop";
    let filled = false;
    const pop = popover(cite, card, {
      onOpen: () => {
        if (filled) return;
        filled = true;
        ids.forEach((id, i) => {
          const item = document.createElement("div");
          item.className = "cite-pop-item";
          const numEl = document.createElement("a");
          numEl.className = "cite-pop-num";
          numEl.href = citeFile ? `${citeFile}#${id}` : `#${id}`;
          numEl.textContent = `[${nums[i]}]`;
          numEl.addEventListener("click", (e) => {
            pop.close(); // dismiss the card, then jump — like DeltaRef's go button
            if(window.Delta?.deck?.goToId(id)) return; // in a deck, page to the target's slide
            if (citeFile) return; // cross-file: let the browser navigate to the other output
            e.preventDefault();
            flashTarget(id);
          });
          const text = document.createElement("span");
          text.className = "cite-pop-text";
          const tpl = [...document.querySelectorAll("template[data-delta-pop]")].find(
            (el) => (el as HTMLTemplateElement).dataset.deltaPop === id,
          ) as HTMLTemplateElement | undefined;
          const paper = tpl?.content.querySelector("delta-paper");
          if (paper) text.append(formatPaper(paper));
          item.append(numEl, text);
          card.append(item);
        });
      },
    });
  }
}

export function defineCite(): void {
  customElements.define("delta-cite", class extends DeltaCite {});
}
