// Delta custom-element pack: a simple <callout> box.
// The compiler renames every author <callout> to <delta-callout>, so the pack
// registers that tag. This script is inlined after the core runtime, so
// window.Delta is available if a pack needs it.
customElements.define(
  "delta-callout",
  class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.deltaReady) return; // connectedCallback can fire again on move
      this.dataset.deltaReady = "true";
      const label = document.createElement("div");
      label.className = "callout-label";
      label.textContent = this.getAttribute("label") || "Note";
      this.prepend(label);
    }
  },
);
