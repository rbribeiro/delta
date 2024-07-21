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

function addEventListeners() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      goToSlide(MyNameSpace.currentSlide + 1);
    } else if (e.key === "ArrowLeft") {
      goToSlide(MyNameSpace.currentSlide - 1);
    }
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
  if (equations) {
    equations.forEach((eq, key) => {
      equationWrapper(eq, key + 1);
    });
  }

  const theorems = document.querySelectorAll("theorem");
  console.log(theorems);
  if (theorems) {
    theorems.forEach((theorem, key) => {
      environmentWrapper(theorem, key);
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

function environmentWrapper(envElement, number) {
  const envName = envElement.tagName.toLowerCase();
  const titleTag = envName + "-title";
  const title = envElement.querySelectorAll(titleTag);

  if (title) {
    title[0].innerHTML = `(${title[0].innerHTML})`;
  }
  const html = envElement.innerHTML;

  const content = `<span class='environment ${envName}'>${envName} ${number + 1}.</span>
                    ${html}
                    `;
  envElement.innerHTML = content;
}

function positionTooltip(event, tooltip) {
  const tooltipRect = tooltip.getBoundingClientRect();
  let left = event.pageX + 10;
  let top = event.pageY + 10;

  // Adjust positioning if the tooltip goes beyond the viewport
  if (left + tooltipRect.width > window.innerWidth) {
    left = event.pageX - tooltipRect.width - 10;
  }
  if (top + tooltipRect.height > window.innerHeight) {
    top = event.pageY - tooltipRect.height - 10;
  }

  tooltip.style.left = left + "px";
  tooltip.style.top = top + "px";
}
document.getElementById("ref").addEventListener("mousemove", (event) => {
  const refId = event.target.getAttribute("ref-id");
  const tooltip = document.getElementById("tool_tip_element");
  if (refId) {
    tooltip.innerHTML = document.getElementById(refId).innerHTML;
    tooltip.classList.add("tooltip");
    tooltip.style.display = "block";
    event.target.appendChild(tooltip);
    positionTooltip(event, tooltip);
  }
});
