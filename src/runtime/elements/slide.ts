/**
 * <slide> — one deck slide (`<document type="presentation">`). Like DeltaSection,
 * it hoists the optional `<delta-title>` child into a real heading shown at the top
 * of the slide; everything else moves into a `.slide-body` so the title can sit at
 * the top while the body is centered (see components/slide.css). Slides aren't
 * numbered — the deck controller (deck.ts) handles position + paging.
 */

class DeltaSlide extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const title = this.querySelector(":scope > delta-title");

    // Everything that isn't the title becomes the (centered) body.
    const body = document.createElement("div");
    body.className = "slide-body";
    for (const child of [...this.childNodes]) {
      if (child === title) continue;
      body.append(child);
    }

    if (title) {
      const heading = document.createElement("h2");
      heading.className = "slide-title";
      heading.append(...title.childNodes);
      title.replaceWith(heading);
    }
    this.append(body);
  }
}

export function defineSlide(): void {
  customElements.define("delta-slide", DeltaSlide);
}
