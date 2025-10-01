function renderTitle() {
  const main = document.querySelector("main");
  if (!main) {
    console.error("<main> element not found");
    return;
  }

  // Should we filter by specific environment components?
  main.querySelectorAll("[title]").forEach((el) => {
    const title = el.getAttribute("title");
    if (!title) return;

    // Change attribute name to avoid conflict with HTML title attribute
    el.setAttribute('dlt-title', title);
    el.removeAttribute('title');

    const titleEl = document.createElement("dlt-title");
    titleEl.innerHTML = title;
    el.prepend(titleEl);
  });
}

function renderEnvironmentsNumberAndName(parent, parentNumber, type) {
  function changeTitleEl(el, number) {
    let titleEl = el.querySelector(":scope > dlt-title");
    const title = number + " " + (titleEl ? titleEl.innerHTML : "");

    // If there is no title, should we add the numbering anyway?
    if (!titleEl) {
      titleEl = document.createElement("dlt-title");
      titleEl.innerHTML = title;
      el.prepend(titleEl);
    }
    titleEl.innerHTML = title;
  }

  // Type can be "subsection" or "section"
  const sections = parent.querySelectorAll(":scope > " + type);

  (sections || []).forEach((section, index) => {
    // Compute section number  
    const numberPrefix = parentNumber != "" ? parentNumber + "." : "";
    const sectionNumber = numberPrefix + String(index + 1);
    section.id = "section" + sectionNumber;

    changeTitleEl(section, sectionNumber);

    Object.keys(ENV_TYPES_JSON).forEach((envType) => {
      section
        .querySelectorAll(":scope > " + envType)
        .forEach((envEl, idx) => {
          const envNumber = sectionNumber + "." + String(idx + 1);
          envEl.id = envType+envNumber; // If needed in the future
          envEl.classList.add("environment");
          const title = ENV_TYPES_JSON[envType].pt + " " + envNumber;
          changeTitleEl(envEl, title);
        });
    });

    // Recurse into subsections
    renderEnvironmentsNumberAndName(
      section,
      sectionNumber,
      "subsection"
    );
  });
}

// Always execute after the title attributes are rendered and the environments are named
function renderTableOfContents() {
  const nav = document.querySelector("nav");
  if (!nav) {
    console.error("<nav> element not found");
    return;
  }
  const toc = document.createElement("table-of-contents");
  nav.appendChild(toc);
}

renderTitle();
renderEnvironmentsNumberAndName(document.querySelector("main"), "", "section");
renderTableOfContents(); // Always execute after the title attributes are rendered and the environments are named