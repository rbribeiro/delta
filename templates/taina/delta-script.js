class DeltaSection extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    const title = document.createElement("h1");
    title.innerHTML = this.getAttribute("title");
    shadow.appendChild(title);

    const slot = document.createElement("slot");
    shadow.appendChild(slot);
  }
}

customElements.define("dlt-section", DeltaSection);

class DeltaStatement extends HTMLElement {
  constructor() {
    super();

    const shadow = this.attachShadow({ mode: "open" });
    const title = document.createElement("h4");
    title.innerHTML = this.getAttribute("type");
    title.style.margin = 0;
    shadow.appendChild(title);

    const slot = document.createElement("slot");
    shadow.appendChild(slot);
  }
}

customElements.define("dlt-statement", DeltaStatement);