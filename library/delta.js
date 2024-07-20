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

function goToSlide(slideNumber) {
  if (slideNumber <= MyNameSpace.totalSlides && slideNumber > 0) {
    const slides = document.querySelectorAll("slide");
    slides[MyNameSpace.currentSlide - 1].classList.remove("active");
    slides[slideNumber - 1].classList.add("active");

    const url = new URL(window.location.href);
    url.searchParams.set("slide", slideNumber);
    window.history.replaceState({}, "", url);

    updateState({ currentSlide: slideNumber });
  }
}

function init() {
  document.addEventListener("DOMContentLoaded", (event) => {
    // get slide number on URL
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    const currentSlide =
      parseInt(urlParams.get("slide")) || MyNameSpace.currentSlide;

    // Load MathJax
    const mathJaxScript = document.createElement("script");
    mathJaxScript.id = "MathJax-script";
    mathJaxScript.src =
      "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js";
    document.head.appendChild(mathJaxScript);

    const slides = document.querySelectorAll("slide");
    const totalSlides = slides.length;
    slides[currentSlide - 1].classList.add("active");

    // Wrapping custom elements
    globalWrapper();

    // Wait for MathJax to load before initial rendering
    mathJaxScript.onload = () => {
      if (window.MathJax) {
        MathJax.typesetPromise();
      }
    };

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") {
        goToSlide(MyNameSpace.currentSlide + 1);
      } else if (e.key === "ArrowLeft") {
        goToSlide(MyNameSpace.currentSlide - 1);
      }
    });

    updateState({ currentSlide, totalSlides });
  });
}

init();

function globalWrapper() {
  const slideTitles = document.querySelectorAll("slide-title");
  if (slideTitles) {
    slideTitles.forEach((title) => {
      title.innerHTML = "<div class='slideTitle'>" + title.innerHTML + "</div>";
    });
  }

  const equations = document.querySelectorAll("equation");
  if (equations) {
    equations.forEach((eq, key) => {
      equationWrapper(eq, key + 1);
    });
  }
}

function equationWrapper(eqElement, eqNumber) {
  const equation = eqElement.innerHTML;
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
