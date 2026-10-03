/**
 * <document> — the root. Its only chrome is the document-level `<meta>` row (author,
 * date, …), rendered like a box's.
 */

import { renderMeta } from "./shared.ts";

class DeltaDocument extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    renderMeta(this);
  }
}

export function defineDocument(): void {
  customElements.define("delta-document", DeltaDocument);
}
