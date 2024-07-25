class tableOfContents extends HTMLElement {
	constructor() {
		super();
		const shadow = this.attachShadow({ mode: "open" });
		const links = document.getElementsByTagName("link");

		Array.from(links).forEach((link) => {
			if (link.getAttribute("role") == "theme") {
				shadow.appendChild(link.cloneNode());
			}
		});
		const ul = document.createElement("ul");
		shadow.appendChild(ul);
		this.ul = ul;
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
            const sectionId = `DELTA_SECTION_${key+1}`
			li.innerHTML = `<a href="#${sectionId}">${title}</a>`;
			this.ul.appendChild(li);
		});
	}
}

customElements.define("table-contents", tableOfContents);
