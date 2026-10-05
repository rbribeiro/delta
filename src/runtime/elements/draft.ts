/**
 * <draft> — loose prose that is still being written, with no header of its own to hang a
 * status mark on (a paragraph or two, a sketched argument between environments):
 *
 *   <draft by="claude" note="the compactness step is hand-waved">…</draft>
 *
 * Renders a dashed-rule block with a `.status-bar` (the "Draft" mark, the note) on top.
 * The compiler sets `status="draft"` when absent; `status="sketch"` etc. work the same
 * way (applyStatus in status.ts, which environments and sections also use).
 * A `--final` build unwraps the prose and drops the marks.
 */

import { applyStatus } from "./status.ts";

class DeltaDraft extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    applyStatus(this, null);
    const note = this.getAttribute("note");
    if (note) {
      const n = document.createElement("span");
      n.className = "status-note";
      n.textContent = note;
      this.querySelector(":scope > .status-bar")?.append(n);
    }
  }
}

export function defineDraft(): void {
  customElements.define("delta-draft", DeltaDraft);
}
