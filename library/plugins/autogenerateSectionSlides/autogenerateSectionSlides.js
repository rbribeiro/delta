const autogenerateSectionSlides = {}

autogenerateSectionSlides.init = function () {
    const sections = document.querySelectorAll("section") || [];

	sections.forEach((section,key) => {
		autogenerateSectionSlides.sectionBuilder(section,key+1);
	});

}

autogenerateSectionSlides.sectionBuilder = function (section, number) {
	if (
		section.children &&
		section.children[0].tagName.toLowerCase() == "title"
	) {
		const titleSlide = document.createElement("slide");
		titleSlide.classList.add("section-intro");
		let sectionTitle = section.children[0].innerHTML;
		const textArea = document.createElement("textarea");
		textArea.innerHTML = sectionTitle;
		sectionTitle = textArea.value;
		titleSlide.innerHTML = `<h1>${sectionTitle}</h1>
								<hr />`;
		if (number) section.setAttribute("id", `DELTA_SECTION_${number}`);
		section.removeChild(section.children[0]);
		section.prepend(titleSlide);
	}
};

autogenerateSectionSlides.init()
