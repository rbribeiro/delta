const MyNameSpace = {
	currentSlide: 1,
	totalSlides: 0,
};

window.MathJax = {
    tex: {
      inlineMath: [['$', '$'], ['\\(', '\\)']]
    },
    svg: {
      fontCache: 'global'
    }
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


        const slideTitles = document.querySelectorAll('slide-title')
        if(slideTitles) {
            slideTitles.forEach(title => {
                title.innerHTML = "<div class='slideTitle'>"+title.innerHTML+"</div>"
            })
        }

        const equations = document.querySelectorAll('equation')
        if(equations) {
            equations.forEach((eq,key) => {
                equationWrapper(eq,key+1)
            })
        }

		// Wait for MathJax to load before initial rendering
		mathJaxScript.onload = () => {
			if (window.MathJax) {
				MathJax.typesetPromise();
			}
		};

		updateState({ totalSlides });
	});
}

init();

function equationWrapper(eqElement,eqNumber) {
    const equation = eqElement.innerHTML;
    eqElement.innerHTML = `<div class="equationContainer">
                                <div class="equationContent">
                                   $$ ${equation} $$
                                </div>
                                <div class="equationNumber">
                                    (${eqNumber})
                                </div>
                            </div>
                        `
}
