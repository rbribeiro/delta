const MyNameSpace = {
	currentSlide: 1,
	totalSlides: 0,
};

window.MathJax = {
	tex: {
		inlineMath: [
			["$", "$"],
			["\\(", "\\)"],
		],
	},
	svg: {
		fontCache: "global",
	},
};

/************************************************************************
 *
 * INIT Function. This is the function that call all the functions the
 * DELTA framework needs to build the presentation
 *
 * ***********************************************************************/
function init() {
	document.addEventListener("DOMContentLoaded", (event) => {
		// Call the function to replace \step commands in the whole document
		replaceStepCommands(document.body);
		// get slide number on URL
		const url = new URL(window.location.href);
		const urlParams = new URLSearchParams(url.search);
		const currentSlide =
			parseInt(urlParams.get("slide")) || MyNameSpace.currentSlide;
		// Create tooltip Object
		const tooltip = document.createElement("div");
		tooltip.id = "tool_tip_element";
		document.body.appendChild(tooltip);

		// Load MathJax
		const mathJaxScript = document.createElement("script");
		mathJaxScript.id = "MathJax-script";
		mathJaxScript.src =
			"https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
		document.head.appendChild(mathJaxScript);

		const slides = document.querySelectorAll("slide");
		const totalSlides = slides.length;
		slides[currentSlide - 1].classList.add("active");
		slides.forEach((slide, key) => {
			slide.setAttribute("number", key + 1);
			slide.setAttribute("id", `DELTA_SLIDE_${key + 1}`);
		});
		// Handling custom elements
		buildCustomElements();
		//add Event Listeners
		addEventListeners();
		// Wait for MathJax to load before initial rendering
		mathJaxScript.onload = () => {
			if (window.MathJax) {
				MathJax.typesetPromise();
			}
		};

		updateState({ currentSlide, totalSlides });
	});
}

init();

/***********************************
 *
 * Add all the event listeners needed
 *
 ***********************************/
function addEventListeners() {
	window.addEventListener("popstate", (e) => {
		const url = new URL(window.location.href);
		const urlParams = new URLSearchParams(url.search);
		const currentSlide = parseInt(urlParams.get("slide")) || 1;

		goToSlide(currentSlide);
	});
	document.addEventListener("keydown", (e) => {
		if (e.key === "ArrowRight") {
			const steps = document
				.getElementById(`DELTA_SLIDE_${MyNameSpace.currentSlide}`)
				.querySelectorAll(".step");
			if (steps.length > 0) {
				steps[0].classList.remove("step");
				steps[0].classList.add("activeStep");
			} else {
				goToSlide(MyNameSpace.currentSlide + 1);
			}
		} else if (e.key === "ArrowLeft") {
			const activatedSteps = document
				.getElementById(`DELTA_SLIDE_${MyNameSpace.currentSlide}`)
				.querySelectorAll(".activeStep");

			if (activatedSteps.length > 0) {
				activatedSteps[activatedSteps.length - 1].classList.remove(
					"activeStep"
				);

				activatedSteps[activatedSteps.length - 1].classList.add("step");
			} else {
				goToSlide(MyNameSpace.currentSlide - 1);
			}
		}
	});

	const eqRefs = document.querySelectorAll("eq-ref") || [];

	eqRefs.forEach((eqRef) => {
		eqRef.addEventListener("mousemove", showToolTip);
		eqRef.addEventListener("mouseout", hideToolTip);
		eqRef.addEventListener("click", referenceClick);
	});

	const refs = document.querySelectorAll("ref") || [];

	refs.forEach((ref) => {
		ref.addEventListener("mousemove", showToolTip);
		ref.addEventListener("mouseout", hideToolTip);
		ref.addEventListener("click", referenceClick);
	});
}

function buildCustomElements() {
	const slideTitles = document.querySelectorAll("slide-title");
	if (slideTitles) {
		slideTitles.forEach((title) => {
			title.innerHTML = "<div class='slideTitle'>" + title.innerHTML + "</div>";
		});
	}

	const equations = document.querySelectorAll("equation");
	if (equations.length > 0) {
		equations.forEach((eq, key) => {
			equationWrapper(eq, key + 1);
		});
	}

	const theorems = document.querySelectorAll("theorem");
	if (theorems.length > 0) {
		theorems.forEach((theorem, key) => {
			environmentWrapper(theorem, key + 1);
		});
	}

	const eqRefs = document.querySelectorAll("eq-ref");
	if (eqRefs.length > 0) {
		eqRefs.forEach((eqRef, key) => {
			const targetId = eqRef.getAttribute("to");
			if (targetId) {
				const eqNumber = document
					.getElementById(targetId)
					.getAttribute("number");
				eqRef.innerHTML += ` (${eqNumber})`;
			}
		});
	}

	const refs = document.querySelectorAll("ref");
	if (refs.length > 0) {
		refs.forEach((ref, key) => {
			const targetId = ref.getAttribute("to");
			if (targetId) {
				const refNumber = document
					.getElementById(targetId)
					.getAttribute("number");
				ref.innerHTML += ` ${refNumber}`;
			}
		});
	}
}

/*****************************************************
 *
 * UTIL FUNCTIONS
 *
 *
 *
 * *************************************************/

/*******************************************
 *
 * update the app's state
 *
 * ********************************************/
function updateState(newState) {
	Object.assign(MyNameSpace, newState);

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
/***********************************
 *
 * Go to slide number slideNumber
 *
 *******************************/
function goToSlide(slideNumber) {
	if (slideNumber <= MyNameSpace.totalSlides && slideNumber > 0) {
		const slides = document.querySelectorAll("slide");
		slides[MyNameSpace.currentSlide - 1].classList.remove("active");
		slides[slideNumber - 1].classList.add("active");

		const url = new URL(window.location.href);
		window.history.pushState({ path: url.href }, "", url.href);
		url.searchParams.set("slide", slideNumber);
		window.history.replaceState({}, "", url);

		updateState({ currentSlide: slideNumber });
	}
}

function equationWrapper(eqElement, eqNumber) {
	const equation = eqElement.innerHTML;
	eqElement.setAttribute("number", eqNumber);
	eqElement.innerHTML = `<div class="equationContainer">
                                <div class="equationContent">
                                   $$ ${equation} $$
                                </div>
                                <div class="equationNumber">
                                    (${eqNumber})
                                </div>
                            </div>
                        `;
}

function environmentWrapper(envElement, number) {
	const envName = envElement.tagName.toLowerCase();
	const titleTag = envName + "-title";
	const title = envElement.querySelectorAll(titleTag);
	envElement.setAttribute("number", number);
	if (title) {
		title[0].innerHTML = `(${title[0].innerHTML})`;
	}
	const html = envElement.innerHTML;

	const content = `<span class='environment ${envName}'>${envName} ${number}.</span>
                    ${html}
                    `;
	envElement.innerHTML = content;
}

function showToolTip(event) {
	const refId = event.target.getAttribute("to");
	const tooltip = document.getElementById("tool_tip_element");
	if (refId) {
		tooltip.innerHTML = document.getElementById(refId).innerHTML;
		tooltip.classList.add("tooltip");
		tooltip.style.display = "block";

		event.target.appendChild(tooltip);
		const tooltipRect = tooltip.getBoundingClientRect();
		let left = event.pageX - 10;
		let top = event.pageY + 10;

		// Adjust positioning if the tooltip goes beyond the viewport
		if (left + tooltipRect.width > window.innerWidth) {
			left = event.pageX - tooltipRect.width + 10;
		}
		if (top + tooltipRect.height > window.innerHeight) {
			top = event.pageY - tooltipRect.height - 10;
		}

		tooltip.style.left = left + "px";
		tooltip.style.top = top + "px";
	}
}

function hideToolTip() {
	document.getElementById("tool_tip_element").style.display = "none";
}

function referenceClick(event) {
	const targetId = event.target.getAttribute("to");
	const target = document.getElementById(targetId);
	if (target) {
		const slideNumber = target
			.findParentByTagName("slide")
			.getAttribute("number");
		goToSlide(slideNumber);
	}
}

function replaceStepCommands(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    let content = node.textContent;
    const parts = content.split('\\step');
    if (parts.length > 1) {
        let newContent = '<span class="step">' + parts.join('</span><span class="step">') + '</span>';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = newContent;

        while (tempDiv.firstChild) {
            node.parentNode.insertBefore(tempDiv.firstChild, node);
        }
        node.parentNode.removeChild(node);
    }
} else if (node.nodeType === Node.ELEMENT_NODE) {
    node.childNodes.forEach(replaceStepCommands);
    processElement(node);
}
}

function processElement(element) {
  let html = element.innerHTML;
        if (html.includes("\\step")) {
            html = html.replace(/\\step/g, '</span><span class="step">');
            html = '<span class="step">' + html + '</span>';
            element.innerHTML = html;
        }
}

/***************************
 *
 * COMPONENTS AND CLASSES
 *
 ****************/
Node.prototype.findParentByTagName = function (tagName) {
	let currentElement = this.parentElement;
	while (currentElement) {
		if (currentElement.tagName.toLowerCase() === tagName.toLowerCase()) {
			return currentElement;
		}
		currentElement = currentElement.parentElement;
	}
	return null;
};

class ProgressBar extends HTMLElement {
	constructor() {
		super();
		const link = document.getElementsByTagName("link")[0].cloneNode();
		const shadow = this.attachShadow({ mode: "open" });
		shadow.appendChild(link);

		const barContainer = document.createElement("div");
		barContainer.classList.add("pbContainer");

		const bar = document.createElement("div");
		bar.classList.add("pb");
		bar.style.width = "0";
		bar.style.height = "100%";

		barContainer.appendChild(bar);
		shadow.appendChild(barContainer);

		this.bar = bar;
	}

	connectedCallback() {
		// Listen for the custom event
		document.addEventListener(
			"appStateChange",
			this.handleCustomEvent.bind(this)
		);
	}

	handleCustomEvent(event) {
		this.bar.style.width = `${
			(100 * event.detail.currentSlide) / event.detail.totalSlides
		}%`;
	}

	updateProgress(current, total) {
		const progress = (current / total) * 100;
		this.innerHTML = `${progress}%`;
	}
}

customElements.define("progress-bar", ProgressBar);
