/** <sidenote> — a responsive margin note (positioned by base.css's `.sidenote`). */
class DeltaSidenote extends HTMLElement {
  connectedCallback(): void{
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";
    this.classList.add("sidenote");
  }
}

export function defineSidenote(): void {
  customElements.define("delta-sidenote", class extends DeltaSidenote {});
}
