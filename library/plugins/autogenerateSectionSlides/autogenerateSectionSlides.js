const autogenerateSectionSlides = {};

autogenerateSectionSlides.init = function () {
  const sections = document.querySelectorAll("section") || [];

  sections.forEach((section, key) => {
    autogenerateSectionSlides.sectionBuilder(section, key + 1);
  });

  const totalSlides = document.querySelectorAll("slide").length;
  Delta.getInstance().updateState({ totalSlides: totalSlides });
};

autogenerateSectionSlides.sectionBuilder = function (section, number) {
  if (
    section.children &&
    section.children[0].tagName.toLowerCase() == "title"
  ) {
    const title = section.children[0];
    const titleSlide = document.createElement("slide");
    const content = document.createElement("content");
    titleSlide.classList.add("section-intro");
    const textArea = document.createElement("textarea");
    textArea.innerHTML = title.innerHTML;
    section.setAttribute("data-title", textArea.innerHTML);
    const slideTitle = document.createElement("h2");
    slideTitle.setAttribute("id", title.id);
    slideTitle.innerHTML = `${textArea.value}`;
    content.append(slideTitle);
    content.append(document.createElement("hr"));

    titleSlide.append(content);
    if (number) section.setAttribute("id", `DELTA_SECTION_${number}`);
    section.prepend(titleSlide);
    //Delta.refListeners()
    section.removeChild(title);
  }
};

// This function must be called before the "isDeltaReady" event to make sure all the new slides have been added before rendering
autogenerateSectionSlides.init();
