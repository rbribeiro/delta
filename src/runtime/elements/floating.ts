/**
 * <floating> — a floating button pinned to the corner of the viewport that
 * expands into a floating panel. Authors drop a `<toc>` (project-scoped or plain)
 * inside it so readers can navigate from anywhere on the page without scrolling
 * back to an inline contents list; the panel holds whatever children are given.
 *
 *   <floating>
 *     <title>Navigate</title>
 *     <toc scope="project"/>
 *   </floating>
 *
 * An optional <title> child (the Delta convention, like <section>/<hint>) labels
 * the button and panel header; it falls back to the localized "Contents". The
 * panel reuses the shared Delta.popover controller (top-layer, flip, Esc +
 * outside-click dismissal), so it flips up from the fixed button.
 */

import { t } from "../i18n";
import { popover } from "../utils";

class DeltaFloating extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    // An optional <delta-title> labels the button + header; clone its children so
    // inline math/markup survive. Fall back to the localized "Contents".
    const titleEl = this.querySelector(":scope > delta-title");
    const labelText = (titleEl?.textContent ?? "").trim() || t("contents", "Contents");
    const titleNodes = titleEl ? [...titleEl.childNodes] : null;
    titleEl?.remove();
    const labelFragment = (): Node | string =>
      titleNodes ? cloneInto(document.createElement("span"), titleNodes) : labelText;

    // The floating action button: a small icon + the label.
    const button = document.createElement("button");
    button.type = "button";
    button.className = "floating-fab";
    button.setAttribute("aria-label", labelText);
    const icon = document.createElement("span");
    icon.className = "floating-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "☰"; // ☰
    button.append(icon, labelFragment());

    // The panel: a header (title + close) and a body holding the floating's
    // children (the <delta-toc> etc.).
    const panel = document.createElement("div");
    panel.className = "floating-panel";

    const header = document.createElement("div");
    header.className = "floating-hd";
    const headTitle = document.createElement("span");
    headTitle.className = "floating-title";
    headTitle.append(labelFragment());
    const close = document.createElement("button");
    close.type = "button";
    close.className = "floating-x";
    close.setAttribute("aria-label", t("close", "Close"));
    close.textContent = "×"; // ×
    header.append(headTitle, close);

    const body = document.createElement("div");
    body.className = "floating-body";
    body.append(...this.childNodes); // the toc (already upgraded) moves in here

    panel.append(header, body);
    this.append(button);

    const pop = popover(button, panel, { gap: 12 });
    close.addEventListener("click", () => pop.close());
    // Picking a destination dismisses the panel.
    body.addEventListener("click", (e) => {
      if ((e.target as Element).closest("a")) pop.close();
    });
  }
}

/** Append clones of `nodes` into `host` and return it (keeps the source intact). */
function cloneInto(host: HTMLElement, nodes: Node[]): HTMLElement {
  for (const n of nodes) host.append(n.cloneNode(true));
  return host;
}

export function defineFloating(): void {
  customElements.define("delta-floating", class extends DeltaFloating {});
}
