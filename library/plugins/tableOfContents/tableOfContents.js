class tableOfContents extends HTMLElement {
	constructor() {
		super();
		const ol = document.createElement("ol");
		this.ol = ol;
		this.appendChild(ol);
		

	}

	connectedCallback() {
		const titles = [];
		const sections = document.querySelectorAll("section") || [];

		sections.forEach((section) => {
			if (section.children.length > 0 && section.children[0].tagName.toLocaleLowerCase() == "title") {
                let sectionTitle = section.children[0].innerHTML;
                const textArea = document.createElement("textarea")
                textArea.innerHTML = sectionTitle
                sectionTitle = textArea.value
				titles.push(sectionTitle);
			}
		});

		titles.forEach((title,key) => {
			const li = document.createElement("li");
			if(this.hasAttribute("animate")) li.classList.add("step")
            const sectionId = `DELTA_SECTION_${key+1}`
			li.innerHTML = `<a href="#${sectionId}">${title}</a>`;
			this.ol.appendChild(li);
		});
	}
}

customElements.define("table-contents", tableOfContents);
