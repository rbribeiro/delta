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

    // This div will contain all the content inside el except for the title (allow us to not display the content inside div and display the title for collapsing an environment)
    // Shouldn't this part be done by python? If we alredy get an HTML file from python with a well defined structure, we don't need to handle this kind of structure change in the browser
    const contentWrapper = document.createElement("div");
    contentWrapper.className = "content-wrapper";

    //childNodes gives us a list of everything inside el. We put everything inside the content-wrapper div
    [...el.childNodes].forEach(child => {
      contentWrapper.appendChild(child);
    });

    el.innerHTML = '';
    // Now that the original element (el) is empty, we rebuild it in the correct order.
    el.appendChild(titleEl);
    el.appendChild(contentWrapper);
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

  // we changed because now the sections and subsections aren't direct parents anymore. Any child tag of the sections and subsections are now a child tag of the content-wrapper div
  let contentParent = parent.querySelector(":scope > .content-wrapper");
  if (!contentParent) {
    contentParent = parent;
  }

  Object.keys(ENV_TYPES_JSON).forEach((envType) => {
    contentParent
      .querySelectorAll(":scope > " + envType)
      .forEach((envEl, idx) => {
        const envNumber = parentNumber + "." + String(idx + 1);
        envEl.id = envType + envNumber;
        envEl.classList.add("environment", "collapsible");
        const title = ENV_TYPES_JSON[envType].pt + " " + envNumber;
        changeTitleEl(envEl, title);
      });
  });

  const sections = contentParent.querySelectorAll(":scope > " + type);



  (sections || []).forEach((section, index) => {
    // Compute section number  
    const numberPrefix = parentNumber != "" ? parentNumber + "." : "";
    const sectionNumber = numberPrefix + String(index + 1);
    section.id = "section" + sectionNumber;

    changeTitleEl(section, sectionNumber);

    section.classList.add("collapsible")

    const envWrapper = section.querySelector(':scope > .content-wrapper')

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