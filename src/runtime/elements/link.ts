/** <link to="…"> — opens an external link in a new tab with a small icon. */

const ICON =
    `<svg class="ext-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" ` +
    `stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="M15 3h6v6"/><path d="M10 14 21 3"/>` +
    `<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/></svg>`;

class DeltaLink extends HTMLElement {
  connectedCallback() {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    const to = this.getAttribute("to");
    if (!to) return;
    const a = document.createElement("a");
    a.className = "ext-link";
    a.href = to;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    while (this.firstChild) a.appendChild(this.firstChild);
    this.appendChild(a);
    a.insertAdjacentHTML("beforeend", ICON);

  }
}

export function defineLink(): void {
  customElements.define("delta-link", class extends DeltaLink {});
}
