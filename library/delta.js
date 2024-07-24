const Delta = {
	state: {
		currentSlide: 0,
		totalSlides: 0,
		drawing: false,
		annotateMode: false,
		environmentList: [
			"theorem",
			"proof",
			"proposition",
			"lemma",
			"example",
			"remark",
			"corollary",
		],
	},
};

/************************************************************************
 *
 * INIT Function. This is the function that call all the functions the
 * DELTA framework needs to build the presentation
 *
 * ***********************************************************************/
function init() {
	document.addEventListener("DOMContentLoaded", () => {
		const currentSlide = getSlideFromURL() || 1
		// Create tooltip Object
		const tooltip = document.createElement("div");
		tooltip.id = "tool_tip_element";
		document.body.appendChild(tooltip);

		const mathJaxScript = loadMathJax();
		document.head.appendChild(mathJaxScript);

		// Handling custom elements
		const totalSlides = buildCustomElements(currentSlide).totalSlides;
		//add Event Listeners
		createEventListeners();

		updateState({ currentSlide, totalSlides });
	});
}

init();

/***********************************
 *
 * Add all the event listeners needed
 *
 ***********************************/
function createEventListeners() {

	windowListeners()
	
	documentListeners();

	canvasListeners();

	refListeners();
}

function buildCustomElements(currentSlide) {
	const slides = document.querySelectorAll("slide");
	const totalSlides = slides.length;
	slides[currentSlide - 1].classList.add("active");
	slides.forEach((slide, key) => {
		slide.setAttribute("number", key + 1);
		slide.setAttribute("id", `DELTA_SLIDE_${key + 1}`);
		const canvas = document.createElement("canvas");
		slide.appendChild(canvas);
		const title = Array.from(slide.children).find(
			(child) => child.tagName.toLowerCase() === "title"
		);
		if (title) {
			const slideTitle = document.createElement("div");
			slideTitle.classList.add("slideTitle");
			slideTitle.innerHTML = title.innerHTML;
			slide.prepend(slideTitle);
			slide.removeChild(title);
		}
	});

	const equations = document.querySelectorAll("equation");
	if (equations.length > 0) {
		equations.forEach((eq, key) => {
			equationBuilder(eq, key + 1);
		});
	}

	Delta.state.environmentList.forEach((envName) => {
		const elements = document.querySelectorAll(envName);
		if (elements.length > 0) {
			elements.forEach((element, key) => {
				environmentBuilder(element, key + 1);
			});
		}
	});

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

	return { totalSlides };
}

/*****************************************************
 *
 * LISTENERS
 *
 *
 *
 * *************************************************/
function windowListeners() {

	window.addEventListener("popstate", (e) => {
		const url = new URL(window.location.href);
		const urlParams = new URLSearchParams(url.search);
		const currentSlide = parseInt(urlParams.get("slide")) || 1;

		goToSlide(currentSlide);
	});


}
function documentListeners() {
	document.addEventListener("keydown", (e) => {
		if (e.key === "ArrowRight") {
			stepForward();
		} else if (e.key === "ArrowLeft") {
			stepBack();
		} else if (e.key === "a") {
			const annotateMode = Delta.state.annotateMode ? false : true;
			updateState({ annotateMode });
		}
	});

	document.addEventListener("stateChange:annotateMode", () => {
		toggleAnnotateMode();
	});
}

function canvasListeners() {
	const canvasList = document.querySelectorAll("canvas");
	canvasList.forEach((canvas) => {
		const ctx = canvas.getContext("2d");
		const ratio = window.devicePixelRatio;
		canvas.width = window.innerWidth * ratio;
		canvas.height = window.innerHeight * ratio;
		canvas.style.width = `${window.innerWidth}px`;
		canvas.style.height = `${window.innerHeight}px`;
		ctx.scale(ratio, ratio);
		ctx.lineWidth = 5;
		ctx.strokeStyle = "#ed6a5a";
		ctx.shadowBlur = 1;
		ctx.shadowColor = "#ed6a5a";

		canvas.addEventListener("mousedown", (e) => {
			if (Delta.state.annotateMode) {
				updateState({ drawing: true });
				ctx.beginPath();
			}
		});

		canvas.addEventListener("mousemove", (e) => {
			if (Delta.state.drawing && Delta.state.annotateMode) {
				ctx.lineTo(e.clientX, e.clientY);
				ctx.stroke();
			}
		});

		canvas.addEventListener("mouseup", () => {
			updateState({ drawing: false });
		});
	});
}

function refListeners() {
	const eqRefs = document.querySelectorAll("eq-ref") || [];

	eqRefs.forEach((eqRef) => {
		eqRef.addEventListener("mousemove", showToolTip);
		eqRef.addEventListener("mouseout", hideToolTip);
		eqRef.addEventListener("click", handleReferenceClick);
	});

	const refs = document.querySelectorAll("ref") || [];

	refs.forEach((ref) => {
		ref.addEventListener("mousemove", showToolTip);
		ref.addEventListener("mouseout", hideToolTip);
		ref.addEventListener("click", handleReferenceClick);
	});
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
	const changedProperties = {};

	for (const key in newState) {
		if (newState[key] != Delta.state[key]) {
			changedProperties[key] = newState[key];
			Delta.state[key] = newState[key];
		}
	}

	//Dispatching events now that all the state has been
	// updated
	for (const key in changedProperties) {
		const event = new CustomEvent(`stateChange:${key}`, {
			detail: Delta.state,
			bubbles: true,
			composed: true,
		});

		document.dispatchEvent(event);
	}
}
/***********************************
 *
 * Go to slide number slideNumber
 *
 *******************************/
function goToSlide(slideNumber) {
	if (slideNumber <= Delta.state.totalSlides && slideNumber > 0) {
		const slides = document.querySelectorAll("slide");
		slides[Delta.state.currentSlide - 1].classList.remove("active");
		slides[slideNumber - 1].classList.add("active");

		const url = new URL(window.location.href);
		window.history.pushState({ path: url.href }, "", url.href);
		url.searchParams.set("slide", slideNumber);
		window.history.replaceState({}, "", url);

		updateState({ currentSlide: slideNumber });
	}
}

function equationBuilder(eqElement, eqNumber) {
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

function environmentBuilder(envElement, number) {
	envElement.classList.add("environment");
	const envName = envElement.tagName.toLowerCase();
	const title = Array.from(envElement.children).find(
		(child) => child.tagName.toLowerCase() === "title"
	);

	envElement.setAttribute("number", number);

	if (envName === "proof") {
		let envTitle = "";
		if (title) {
			envTitle = title.innerHTML;
			envElement.removeChild(title);
		}
		const content = `<span class='environment-name ${envName}'>${envTitle}.</span>
    ${envElement.innerHTML}
	<div class='proof-footer'>&#9632;</div>
    `;
		envElement.innerHTML = content;
	} else {
		if (title) {
			const titleElement = document.createElement("span");
			titleElement.classList.add("environment-title");
			titleElement.innerHTML = `(${title.innerHTML})`;
			envElement.prepend(titleElement);
			envElement.removeChild(title);
		}
		const content = `<span class='environment-name ${envName}'>${envName} ${number}.</span>
                    ${envElement.innerHTML}
                    `;
		envElement.innerHTML = content;
	}
}

function getSlideFromURL() {
	const url = new URL(window.location.href);
	const urlParams = new URLSearchParams(url.search);
	return parseInt(urlParams.get("slide"));
}

function loadMathJax() {
	// Load MathJax
	const mathJaxScript = document.createElement("script");
	mathJaxScript.id = "MathJax-script";
	mathJaxScript.src =
		"https://cdn.jsdelivr.net/npm/mathjax@2/MathJax.js?config=TeX-AMS_CHTML";

	return mathJaxScript;
}

function stepForward() {
	const steps = document
		.getElementById(`DELTA_SLIDE_${Delta.state.currentSlide}`)
		.querySelectorAll(".step");
	if (steps.length > 0) {
		steps[0].classList.remove("step");
		steps[0].classList.add("activeStep");
	} else {
		goToSlide(parseInt(Delta.state.currentSlide) + 1);
	}
}

function stepBack() {
	const activatedSteps = document
		.getElementById(`DELTA_SLIDE_${Delta.state.currentSlide}`)
		.querySelectorAll(".activeStep");

	if (activatedSteps.length > 0) {
		activatedSteps[activatedSteps.length - 1].classList.remove("activeStep");

		activatedSteps[activatedSteps.length - 1].classList.add("step");
	} else {
		goToSlide(Delta.state.currentSlide - 1);
	}
}

function showToolTip(event) {
	const refId = event.target.getAttribute("to");
	const targetElement = document.getElementById(refId).cloneNode(true);
	targetElement.id = "";
	const tooltip = document.getElementById("tool_tip_element");
	if (refId) {
		tooltip.innerHTML = "";
		tooltip.append(targetElement);
		tooltip.classList.add("tooltip");
		tooltip.style.display = "block";

		const elements = tooltip.querySelectorAll("*");
		elements.forEach((element) => {
			element.classList.remove("step");
			element.classList.remove("activeStep");
		});

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

function toggleAnnotateMode() {
	const canvasList = document.querySelectorAll("canvas");
	canvasList.forEach((canvas) => {
		canvas.style.pointerEvents = Delta.state.annotateMode
			? "visible"
			: "none";
		canvas.style.cursor = Delta.state.annotateMode
			? "crosshair"
			: "default";
	});
}

function handleReferenceClick(event) {
	const targetId = event.target.getAttribute("to");
	const target = document.getElementById(targetId);
	if (target) {
		const slideNumber = target
			.findParentByTagName("slide")
			.getAttribute("number");
		goToSlide(slideNumber);
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
		// Listen for change in the current slide
		document.addEventListener(
			"stateChange:currentSlide",
			this.handleStateChange.bind(this)
		);
	}

	handleStateChange(e) {
		this.updateProgress(e.detail.currentSlide,e.detail.totalSlides)
	}

	updateProgress(current, total) {
		this.bar.style.width = `${
			(100 * current) / total
		}%`;

	}
}

customElements.define("progress-bar", ProgressBar);
