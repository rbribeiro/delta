/**
 * <code lang="…"> — the highlighted display block. The compiler ships the
 * highlight.js spans (src/compiler/code.ts); this element builds the chrome: a
 * header (language label + copy button), an optional line-number gutter, and
 * collapsible folding. Inline <c> is styled by CSS alone and needs no element.
 */

import { t } from "../i18n";
import { applyCollapsible } from "./shared";

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
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "code-copy";
    copy.textContent = t("copy", "Copy");
    copy.addEventListener("click", () => {
      void navigator.clipboard?.writeText(source).then(() => {
        copy.textContent = t("copied", "Copied");
        copy.classList.add("is-copied");
        setTimeout(() => {
          copy.textContent = t("copy", "Copy");
          copy.classList.remove("is-copied");
        }, 1400);
      });
    });
    head.append(label, copy);

    this.append(head, body);
    applyCollapsible(this, head);
  }
}

export function defineCode(): void {
  customElements.define("delta-code", DeltaCode);
}
