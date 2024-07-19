const MyNameSpace = {
	currentSlide: 1,
	totalSlides: 0,
};

function updateState(newState) {
	Object.assign(MyNameSpace, newState);

	console.log("updateState");
	const event = new CustomEvent("appStateChange", {
		detail: {
			currentSlide: MyNameSpace.currentSlide,
			totalSlides: MyNameSpace.totalSlides,
		},
		bubbles: true,
		composed: true,
	});

	document.dispatchEvent(event);
	
}

function goToSlide(slideNumber) {
	if (slideNumber <= MyNameSpace.totalSlides && slideNumber > 0) {
		const slides = document.querySelectorAll("slide");
		slides[MyNameSpace.currentSlide - 1].classList.remove("active");
		slides[slideNumber - 1].classList.add("active");
		updateState({ currentSlide: slideNumber });
	}
}

function init() {
	document.addEventListener("DOMContentLoaded", (event) => {
        // Link to CSS
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = "assets/css/default.css";
		document.head.appendChild(link);

		// Load MathJax
		const mathJaxScript = document.createElement("script");
		mathJaxScript.id = "MathJax-script";
		mathJaxScript.src =
			"https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
		document.head.appendChild(mathJaxScript);

		const slides = document.body.querySelectorAll("slide");
		const totalSlides = slides.length;

		slides[MyNameSpace.currentSlide - 1].classList.add("active");

		document.addEventListener("keydown", (e) => {
			if (e.key === "ArrowRight") {
				goToSlide(MyNameSpace.currentSlide + 1);
			} else if (e.key === "ArrowLeft") {
				goToSlide(MyNameSpace.currentSlide - 1);
			}
		});

		// Wait for MathJax to load before initial rendering
		mathJaxScript.onload = () => {
			if (window.MathJax) {
				MathJax.typesetPromise();
			}
		};

		slides.forEach((slide) => {
			if (slide.getAttribute("title")) {
				const title = document.createElement("div");
				title.classList.add("slide-title");
				title.innerHTML = slide.getAttribute("title");
				slide.prepend(title);
			}
		});

		updateState({ totalSlides });
	});
}

init();
