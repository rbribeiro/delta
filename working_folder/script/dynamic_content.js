function renderTitleAttribute() {
  const main = document.querySelector("main");
  if (!main) {
    console.error("<main> element not found");
    return;
  }

  // Should we filter by specific section/statement components?
  main.querySelectorAll("[title]").forEach((el) => {
    const title = el.getAttribute("title");
    if (!title) return;

    const titleEl = document.createElement("title");
    titleEl.innerHTML = title;
    el.prepend(titleEl);
  });
}

function renderTableOfContents() {
  const nav = document.querySelector("nav");
  if (!nav) {
    console.error("<nav> element not found");
    return;
  }
  const toc = document.createElement("table-of-contents");
  nav.appendChild(toc);
}

renderTitleAttribute();
renderTableOfContents();
