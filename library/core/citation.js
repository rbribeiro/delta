class BibItem extends HTMLElement {
  constructor() {
    super();
    this.classList.add("bib-item");
  }

  connectedCallback() {
    this.sortChildrenByFixedOrder();
  }

  get authors() {
    const authorsElement = this.querySelector("authors");
    if (authorsElement) {
      this.authors = authorsElement.innerText;
    } else {
      this.authors = null;
    }

    return this.authors;
  }
  sortChildrenByFixedOrder() {
    const fixedOrder = [
      "authors",
      "title",
      "journal",
      "volume",
      "issue",
      "page",
      "year",
      "doi",
      "url",
    ];

    // Get all child elements
    const childrenArray = Array.from(this.children);

    // Sort children according to the fixed order
    childrenArray.sort((a, b) => {
      const orderA =
        fixedOrder.indexOf(a.tagName.toLowerCase()) == -1
          ? 100
          : fixedOrder.indexOf(a.tagName.toLowerCase());
      const orderB =
        fixedOrder.indexOf(b.tagName.toLowerCase()) == -1
          ? -100
          : fixedOrder.indexOf(b.tagName.toLowerCase());
      return orderA - orderB;
    });

    // Clear the current children
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }

    // Append the sorted children
    childrenArray.forEach((child) => {
      this.appendChild(child);
    });
  }
}

class Bibliography extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.convertChildrenToList();
  }

  convertChildrenToList() {
    const ol = document.createElement("ol");
    ol.classList.add("bib-list");

    Array.from(this.children).forEach((child, key) => {
      const li = document.createElement("li");
      const newChild = child.cloneNode(true);
      newChild.setAttribute("number", key + 1);
      li.appendChild(newChild);
      ol.appendChild(li);
    });

    // Clear the current children
    while (this.firstChild) {
      this.removeChild(this.firstChild);
    }

    this.appendChild(ol);
  }
}

class Citation extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const ids = this.getAttribute("ids");
    if (ids) {
      const idArray = ids.split(",").map((name) => name.trim());
      this.appendChild(document.createTextNode("["));
      idArray.forEach((id, key) => {
        const bibItem = document.getElementById(id);
        if (bibItem) {
          const refElement = document.createElement("a");
          refElement.innerHTML = bibItem.getAttribute("number")
            ? bibItem.getAttribute("number")
            : "??";
          refElement.addEventListener("mousemove", () => {
            Delta.getInstance().showToolTip(id);
          });
          refElement.addEventListener("mouseout", () => {
            Delta.getInstance().hideToolTip();
          });
          this.appendChild(refElement);
          if (key < idArray.length - 1) {
            this.appendChild(document.createTextNode(","));
          }
        } else {
          this.appendChild(document.createTextNode("??"));
          if (key < idArray.length - 1) {
            this.appendChild(document.createTextNode(","));
          }
        }
      });
      this.appendChild(document.createTextNode("]"));
    }
  }

}
