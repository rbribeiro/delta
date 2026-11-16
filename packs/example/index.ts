import { label } from "./label.ts";

/**
 * `<pack-example>…</pack-example>`: its content in a card, under a localized label.
 *
 * The smallest standard pack, and the template to copy: one root element, its chrome built
 * once in `connectedCallback`, a helper in a sibling module, core reached only through
 * `window.Delta`, and every visible string through `Delta.t`.
 */
class DeltaPackExample extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return; // can fire again when the element moves
    this.dataset.deltaReady = "1";
    const body = document.createElement("div");
    body.className = "pack-example-body";
    body.append(...this.childNodes);
    this.replaceChildren(label(), body);
  }
}

customElements.define("delta-pack-example", DeltaPackExample);
