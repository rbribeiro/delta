/**
 * <code lang="…"> — the highlighted display block. The compiler ships the
 * highlight.js spans (src/compiler/code.ts); this element builds the chrome: a
 * header (language label + copy button), an optional line-number gutter, and
 * collapsible folding. Inline <c> is styled by CSS alone and needs no element.
 */

import { t } from "../i18n";
import { applyCollapsible, copyButton, numberedName } from "./shared";

class DeltaCode extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const source = this.textContent ?? "";

    // Move the highlighted nodes into <pre><code>, beside an optional gutter.
    const pre = document.createElement("pre");
    pre.className = "code-src";
    const codeEl = document.createElement("code");
    while (this.firstChild) codeEl.append(this.firstChild);
    pre.append(codeEl);

    const body = document.createElement("div");
    body.className = "code-body";
    if (this.getAttribute("lines") !== "false") {
      const n = source.replace(/\n$/, "").split("\n").length;
      const gutter = document.createElement("span");
      gutter.className = "code-gutter";
      gutter.setAttribute("aria-hidden", "true");
      gutter.textContent = Array.from({ length: n }, (_, i) => String(i + 1)).join("\n");
      body.append(gutter);
    }
    body.append(pre);

    // Header: language label + copy button (the label rides the collapse toggle).
    const head = document.createElement("div");
    head.className = "code-head";
    const lang = this.getAttribute("lang");
    const label = document.createElement("span");
    label.className = "code-lang";
    label.textContent = (lang || t("code", "Code")).toUpperCase();
    head.append(label, copyButton("code-copy", t("copy", "Copy"), () => source));
    this.append(head, body);

    // A numbered block gets a "Code 1.2" caption underneath.
    const num = this.getAttribute("num");
    if (num) {
      const footer = document.createElement("div");
      footer.className = "code-cap";
      const lbl = document.createElement("span");
      lbl.className = "lbl";
      lbl.textContent = numberedName("code", num);
      footer.append(lbl, " ");
      this.append(footer);
    }

    applyCollapsible(this, head);
  }
}

export function defineCode(): void {
  customElements.define("delta-code", DeltaCode);
}
