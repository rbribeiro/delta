// TODO: create link to section
function generateSectionsSummary() {
  function generateSubsectionsSummary(parent, parentIdx) {
    const subsections = parent.querySelectorAll(":scope > subsection");

    if ((subsections || []).length == 0) {
      return document.createDocumentFragment();
    }

    const ul = document.createElement("ul");

    let count = 1;
    // avoid repeated code here - create component?
    for (let subsection of subsections || []) {
      const subsectionIdx = parentIdx + "." + String(count);
      subsection.setAttribute("section-idx", subsectionIdx);

      const titleEl = subsection.querySelector(":scope > title");
      const title = subsectionIdx + " " + (titleEl ? titleEl.innerHTML : "");

      if (titleEl) {
        titleEl.innerHTML = title;
      }

      const li = document.createElement("li");
      li.innerHTML = title;

      const subsectionsSummaryList = generateSubsectionsSummary(
        subsection,
        subsectionIdx
      );
      li.appendChild(subsectionsSummaryList);

      ul.appendChild(li);

      count++;
    }

    return ul;
  }

  const sections = document.querySelectorAll("section");
  const summaryList = document.getElementById("summary-list");

  let count = 1;
  for (let section of sections) {
    const sectionIdx = String(count);
    section.id = "section-" + sectionIdx;

    const titleEl = section.querySelector(":scope > title");
    const title = sectionIdx + " " + (titleEl ? titleEl.innerHTML : "");

    if (titleEl) {
      titleEl.innerHTML = title;
    }

    const li = document.createElement("li");
    li.innerHTML = title; // if the section doens't have a title, should it be listed?

    const subsectionsSummaryList = generateSubsectionsSummary(
      section,
      sectionIdx
    );
    li.appendChild(subsectionsSummaryList);

    summaryList.appendChild(li);

    count++;
  }
}

function renderRefBox(refId) {
  ref = document.getElementById(refId).cloneNode(true);

  refWrapper = document.createElement("div");
  refWrapper.className = "ref-wrapper";

  const closeBtn = document.createElement("span");
  closeBtn.className = "close-ref";
  closeBtn.innerHTML = "&times;";
  closeBtn.onclick = () => refWrapper.remove();

  refContent = document.createElement("div");
  refContent.className = "ref-content";

  refContent.appendChild(closeBtn);
  refContent.appendChild(ref);
  refWrapper.appendChild(refContent);

  document.body.appendChild(refWrapper);
}

function renderStatementTitles() {}

generateSectionsSummary();

document.querySelectorAll("ref").forEach((ref) => {
  refId = ref.getAttribute("ref-id");
  ref.onclick = () => {
    renderRefBox(refId);
  };
});
