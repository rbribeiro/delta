// Table of Contents component should be created after the title tags are added to the sections
// It generates a nested list of sections and subsections based on the titles
class TableOfContents extends HTMLElement {
  connectedCallback() {
    const main = document.querySelector("main");
    if (!main) {
      console.error("<main> element not found");
      return;
    }

    const toc = this.#generateTableOfContents(main, "", "section");
    this.appendChild(toc);
  }

  #generateTableOfContents(parent, parentIdx, type) {
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

    let count = 1;
    for (let section of sections) {
      const idxPrefix = parentIdx != "" ? parentIdx + "." : "";
      const sectionIdx = idxPrefix + String(count);
      section.setAttribute("section-idx", sectionIdx);

      const titleEl = section.querySelector(":scope > title");
      const title = sectionIdx + " " + (titleEl ? titleEl.innerHTML : "");

      // Add numbering to the section title
      // If there is no title, should we add the numbering anyway?
      if (titleEl) {
        titleEl.innerHTML = title;
      }

      const li = document.createElement("li");
      li.innerHTML = title;

      const subsections = this.#generateTableOfContents(
        section,
        sectionIdx,
        "subsection"
      );
      li.appendChild(subsections);

      ul.appendChild(li);

      count++;
    }

    return ul;
  }
}

customElements.define("table-of-contents", TableOfContents);
