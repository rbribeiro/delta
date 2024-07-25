class ProgressBar extends HTMLElement {
	constructor() {
		super();
		const links = document.getElementsByTagName("link")
		const shadow = this.attachShadow({ mode: "open" });

		Array.from(links).forEach(link => {
			if(link.getAttribute("role") == "theme") {
				shadow.appendChild(link.cloneNode())
			}
		});
		

		const barContainer = document.createElement("div");
		barContainer.classList.add("pb-container");

		const bar = document.createElement("div");
		bar.classList.add("pb");
		bar.style.width = "0";
		bar.style.height = "100%";

		barContainer.appendChild(bar);
		shadow.appendChild(barContainer);

		this.bar = bar;
	}

	connectedCallback() {
		// Listen for change in the current slide
		document.addEventListener(
			"stateChange:currentSlide",
			this.handleStateChange.bind(this)
		);
	}

	handleStateChange(e) {
		this.updateProgress(e.detail.currentSlide, e.detail.totalSlides);
	}

	updateProgress(current, total) {
		this.bar.style.width = `${(100 * current) / total}%`;
	}
}

customElements.define("progress-bar", ProgressBar);
