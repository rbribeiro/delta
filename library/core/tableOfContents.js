// TODO: Style
// TODO: Floating and fixed modes
class TableOfContents extends HTMLElement {
  constructor() {
    super();
    this.classList.add("table-contents");
  }

  connectedCallback() {
    this.render();
  }
  render() {
    this.interHTML = "";
    const ol = document.createElement("ol");
    ol.classList.add("top-level");
    const sections = document.querySelectorAll("section:not([no-number])");

    sections.forEach((section) => {
      const li = document.createElement("li");
      if (this.hasAttribute("animate")) li.classList.add("step");
      const span = document.createElement("span");
      span.innerHTML = section.children[0].innerHTML;
      span.classList.add("table-content-item");
      span.addEventListener("click", () => {
        section.scrollIntoView({ behavior: "smooth" });
      });
      li.appendChild(span);
      const subsections = section.querySelectorAll(
        "subsection:not([no-number])",
      );
      if (subsections.length > 0) {
        const olss = document.createElement("ol");
        subsections.forEach((ss) => {
          const liss = document.createElement("li");
          const spanss = document.createElement("span");
          spanss.innerHTML = ss.children[0].innerHTML;

          spanss.classList.add("table-content-item");
          spanss.addEventListener("click", () => {
            ss.scrollIntoView({ behavior: "smooth" });
          });

          liss.appendChild(spanss);
          olss.appendChild(liss);
        });
        li.append(olss);
      }
      ol.appendChild(li);
    });
    this.append(ol);
  }
}
