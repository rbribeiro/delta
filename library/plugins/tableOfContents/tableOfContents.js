class tableOfContents extends HTMLElement {
  constructor() {
    super();
    const ol = document.createElement("ol");
    this.ol = ol;
    this.appendChild(ol);
    const titles = [];
    const sections = document.querySelectorAll("section") || [];
    sections.forEach((section) => {
      const dataTitle = section.getAttribute("data-title");
      if (dataTitle) {
        titles.push(dataTitle);
      } else if (
        section.children.length > 0 &&
        section.children[0].tagName.toLocaleLowerCase() == "title"
      ) {
        let sectionTitle = section.children[0].innerHTML;
        const textArea = document.createElement("textarea");
        textArea.innerHTML = sectionTitle;
        sectionTitle = textArea.value;
        titles.push(sectionTitle);
      }
    });

    titles.forEach((title, key) => {
      const li = document.createElement("li");
      const a = document.createElement("a");
      if (this.hasAttribute("animate")) li.classList.add("step");
      const sectionId = `DELTA_SECTION_${key + 1}`;
      a.addEventListener("click", () => {
        this.handleClick(sectionId);
      });
      a.innerHTML = title;
      li.appendChild(a);
      this.ol.appendChild(li);
    });
  }

  connectedCallback() {
    
  }

  handleClick(id) {
    Delta.goToElementById(id);
  }
}

customElements.define("table-contents", tableOfContents);
