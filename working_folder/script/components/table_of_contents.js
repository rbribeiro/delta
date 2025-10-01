// Table of Contents component should be created after the title tags are added to the sections
// It generates a nested list of sections and subsections based on the titles
class TableOfContents extends HTMLElement {
  connectedCallback() {
    const main = document.querySelector("main");
    if (!main) {
      console.error("<main> element not found");
      return;
    }

    const toc = this.#generateTableOfContents(main, "section");
    this.appendChild(toc);
  }

  #generateTableOfContents(parent, type) {
    // Type can be "subsection" or "section"
    const sections = parent.querySelectorAll(":scope > " + type);

    // No more sections in the tree
    if ((sections || []).length == 0) {
      return document.createDocumentFragment();
    }

    const ul = document.createElement("ul");
    if (type == "section") {
      ul.id = "table-of-contents";
    }

    sections.forEach((section) => {
      const titleEl = section.querySelector(":scope > dlt-title");
      // the current logic already creates a title for every section (in dynamic_content.js/renderTitle)
      // but, just in case, we handle the case where there is no title
      const title = titleEl ? titleEl.innerHTML : "";

      const li = document.createElement("li");
      const a = document.createElement("a");
      a.innerHTML = title;
      a.href = "#" + section.id;
      li.appendChild(a);

      const subsections = this.#generateTableOfContents(
        section,
        "subsection"
      );
      li.appendChild(subsections);

      ul.appendChild(li);
    });

    return ul;
  }
}

customElements.define("table-of-contents", TableOfContents);
