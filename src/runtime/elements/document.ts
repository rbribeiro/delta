class DeltaDocument extends HTMLElement {
  connectedCallback() {
    if (this.dataset.deltaReady == "1") return;
    this.dataset.deltaReady = "1";


    // render the meta info 
    const meta = this.querySelector(':scope > delta-meta');
    if (meta) {
      const metaItems = meta.querySelectorAll(':scope > delta-meta-item');
      if (metaItems.length) {
        const boxMetaDiv = document.createElement("div");
        boxMetaDiv.classList.add("box-meta");
        Array.from(metaItems).forEach(element => {
          const boxMetaItem = document.createElement("span")
          boxMetaItem.className = "box-meta-item";
          const metaItemKey = document.createElement("span")
          metaItemKey.className = "k"
          metaItemKey.textContent = element.getAttribute("key") ?? "";
          const metaItemValue = document.createElement("span");
          metaItemValue.innerHTML = element.innerHTML;
          metaItemValue.className = "v"

          boxMetaItem.append(metaItemKey)
          boxMetaItem.append(metaItemValue)
          boxMetaDiv.append(boxMetaItem)
        });
        meta.replaceWith(boxMetaDiv)
      }
    }


  }
}


export function defineDocument() {
  customElements.define("delta-document", class extends DeltaDocument { })
}
