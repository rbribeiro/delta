const autogenerateSectionSlides = {};

autogenerateSectionSlides.init = function () {
	const sections = document.querySelectorAll("section") || [];

	sections.forEach((section, key) => {
		autogenerateSectionSlides.sectionBuilder(section, key + 1);
	});

	const totalSlides = document.querySelectorAll("slide").length;
	Delta.updateState({ totalSlides: totalSlides });
};

autogenerateSectionSlides.sectionBuilder = function (section, number) {
	if (
		section.children &&
		section.children[0].tagName.toLowerCase() == "title"
	) {
		const title = section.children[0];
		const titleSlide = document.createElement("slide");
		titleSlide.classList.add("section-intro");
		const textArea = document.createElement("textarea");
		textArea.innerHTML = title.innerHTML;
		section.setAttribute("data-title", textArea.innerHTML);
		titleSlide.innerHTML = `<h1>${textArea.value}</h1>
								<hr />`;
		if (number) section.setAttribute("id", `DELTA_SECTION_${number}`);
		Delta.render(titleSlide);
		section.prepend(titleSlide);
    Delta.refListeners()
		section.removeChild(title);
	}
};

document.addEventListener("deltaIsReady", () => {
	autogenerateSectionSlides.init();
});
