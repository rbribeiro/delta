const Delta = {
  state: {
    currentSlide: 0,
    totalSlides: 0,
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
  plugins: [
    {
      id: "progressBar",
      src: "./library/plugins/progressBar/progressBar.js",
    },
    {
      id: "annotation",
      src: "./library/plugins/annotation/annotation.js",
    },
    {
      id: "slideCounter",
      src: "./library/plugins/counter/counter.js",
    },
    {
      id: "MathJax",
      src: "https://cdn.jsdelivr.net/npm/mathjax@2/MathJax.js?config=TeX-AMS_CHTML",
    },
    {
      id: "tableOfContents",
      src: "./library/plugins/tableOfContents/tableOfContents.js",
    },
    {
      id: "autogenerateSectionSlides",
      src: "./library/plugins/autogenerateSectionSlides/autogenerateSectionSlides.js",
    },
  ],
};

/************************************************************************
 *
 * INIT Function. This is the function that call all the functions the
 * DELTA framework needs to build the presentation
 *
 * ***********************************************************************/

document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("hidden-overflow");
  const currentSlide = Delta.getSlideFromURL() || 1;
  // Create tooltip Object
  const tooltip = document.createElement("div");
  tooltip.id = "tool_tip_element";
  document.body.appendChild(tooltip);

  try {
    await Delta.loadPlugins(Delta.plugins);
    // Handling custom elements
    const totalSlides = Delta.buildCustomElements(currentSlide).totalSlides;
    //add Event Listeners
    Delta.createEventListeners();
    Delta.updateState({ currentSlide, totalSlides });
    MathJax.Hub.Queue(function () {
      const equations = document.querySelectorAll("equation");
      equations.forEach((eq) => {
        if (eq.hasAttribute("animate")) {
          const atoms = eq.querySelectorAll(".mjx-texatom");
          atoms.forEach((atom) => {
            if (atom.parentNode.classList.contains("mjx-mrow")) {
              atom.classList.add("step");
            }
          });
        }
      });
    });
  } catch (error) {
    document.write(`<h1>${error}</h1>`);
  }
});

/***********************************
 *
 * Add all the event listeners needed
 *
 ***********************************/
Delta.createEventListeners = function () {
  Delta.windowListeners();

  Delta.documentListeners();

  Delta.refListeners();
};

Delta.loadPlugins = async function (plugins) {
  return Promise.all(
    plugins.map((plugin) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = plugin.src;
        script.async = true;
        script.id = plugin.id;
        script.onload = resolve;
        script.onerror = () => {
          console.error(`Failed to load plugin ${plugin.id}`);
          reject(new Error(`Failed to load plugin ${plugin.id}`));
        };
        document.head.appendChild(script);
      });
    }),
  );
};

Delta.buildCustomElements = function (currentSlide) {
  const slides = document.querySelectorAll("slide") || [];
  const totalSlides = slides.length;
  slides[currentSlide - 1].classList.add("active");
  slides.forEach((slide, key) => {
    slide.setAttribute("number", key + 1);
    slide.setAttribute("id", `DELTA_SLIDE_${key + 1}`);
    const title = Array.from(slide.children).find(
      (child) => child.tagName.toLowerCase() === "title",
    );
    if (title) {
      const slideTitle = document.createElement("div");
      slideTitle.classList.add("slide-title");
      slideTitle.innerHTML = title.innerHTML;
      slide.prepend(slideTitle);
      slide.removeChild(title);
    } else {
      slide.classList.add("vertically-centered");
    }
  });

  const imgs = document.querySelectorAll("img") || [];

  imgs.forEach((img, key) => {
    Delta.imgBuilder(img, key);
  });

  const blockquotes = document.querySelectorAll("blockquote") || [];
  blockquotes.forEach((quote) => {
    Delta.blockquoteBuilder(quote);
  });

  const columnsList = document.querySelectorAll("columns") || [];
  columnsList.forEach((columns) => {
    Delta.columnsBuilder(columns);
  });

  const equations = document.querySelectorAll("equation") || [];
  equations.forEach((eq, key) => {
    Delta.equationBuilder(eq, key + 1);
  });

  Delta.state.environmentList.forEach((envName) => {
    const elements = document.querySelectorAll(envName);
    if (elements.length > 0) {
      elements.forEach((element, key) => {
        Delta.environmentBuilder(element, key + 1);
      });
    }
  });

  const eqRefs = document.querySelectorAll("eq-ref") || [];
  eqRefs.forEach((eqRef) => {
    const targetId = eqRef.getAttribute("to");
    if (targetId) {
      const eqNumber = document.getElementById(targetId).getAttribute("number");
      eqRef.innerHTML += ` (${eqNumber})`;
    }
  });

  const refs = document.querySelectorAll("ref") || [];
  refs.forEach((ref) => {
    const targetId = ref.getAttribute("to");
    if (targetId) {
      const refNumber = document
        .getElementById(targetId)
        .getAttribute("number");
      ref.innerHTML += ` ${refNumber}`;
    }
  });

  const eventBuiltDone = new Event("customElementsBuilt");
  document.dispatchEvent(eventBuiltDone);

  return { totalSlides };
};

/*****************************************************
 *
 * LISTENERS
 *
 *
 *
 * *************************************************/
Delta.windowListeners = function () {
  window.addEventListener("popstate", (e) => {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    const currentSlide = parseInt(urlParams.get("slide")) || 1;

    Delta.goToSlide(currentSlide);
  });

  window.addEventListener("beforeprint", (e) => {
    document.body.classList.remove("hidden-overflow");
  });

  window.addEventListener("afterprint", () => {
    document.body.classList.add("hidden-overflow");
  });
};

Delta.documentListeners = function () {
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") {
      Delta.stepForward();
    } else if (e.key === "ArrowLeft") {
      Delta.stepBack();
    }
  });
};

Delta.refListeners = function () {
  const eqRefs = document.querySelectorAll("eq-ref") || [];

  eqRefs.forEach((eqRef) => {
    eqRef.addEventListener("mousemove", Delta.showToolTip);
    eqRef.addEventListener("mouseout", Delta.hideToolTip);
    eqRef.addEventListener("click", Delta.handleReferenceClick);
  });

  const refs = document.querySelectorAll("ref") || [];

  refs.forEach((ref) => {
    ref.addEventListener("mousemove", Delta.showToolTip);
    ref.addEventListener("mouseout", Delta.hideToolTip);
    ref.addEventListener("click", Delta.handleReferenceClick);
  });
};

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
Delta.updateState = function (newState) {
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
};
/***********************************
 *
 * Go to slide number slideNumber
 *
 *******************************/
Delta.goToSlide = function (slideNumber) {
  if (slideNumber <= Delta.state.totalSlides && slideNumber > 0) {
    const slides = document.querySelectorAll("slide");
    slides[Delta.state.currentSlide - 1].classList.remove("active");
    slides[slideNumber - 1].classList.add("active");

    const url = new URL(window.location.href);
    window.history.pushState({ path: url.href }, "", url.href);
    url.searchParams.set("slide", slideNumber);
    window.history.replaceState({}, "", url);

    Delta.updateState({ currentSlide: slideNumber });
  }
};

Delta.imgBuilder = function (img, imgNumber) {
  const wrapper = document.createElement("div");
  const rotationAngle = img.getAttribute("rotate") || 0;
  const caption = img.getAttribute("caption");
  imgNumber = img.hasAttribute("numbered") ? ` ${imgNumber}.` : ".";
  img.style.transform = `rotate(${rotationAngle}deg)`;
  const imgId = img.id;
  if (caption || img.hasAttribute("numbered")) {
    wrapper.classList.add("img-wrapper");
    const captionContainer = document.createElement("div");
    captionContainer.classList.add("caption-container");
    captionContainer.innerHTML = `<span class='figure-name'>Figure${imgNumber}</span> <span class='caption-text'>${caption}</span>`;
    if (imgId) {
      wrapper.id = img.id;
      img.id = "";
    }

    img.parentNode.insertBefore(wrapper, img);
    wrapper.appendChild(img);
    wrapper.appendChild(captionContainer);
  }
};

Delta.equationBuilder = function (eqElement, eqNumber) {
  const equation = eqElement.innerHTML;
  const stepClass = eqElement.hasAttribute("animate") ? "step" : "";
  eqElement.setAttribute("number", eqNumber);
  eqElement.innerHTML = `<div class="equation-container">
                                <div class="equation-content">
                                   $$ ${equation} $$
                                </div>
                                <div class="equation-number ${stepClass}">
                                    (${eqNumber})
                                </div>
                            </div>
                        `;
};

Delta.goToElementById = function (id) {
  const element = document.getElementById(id);
  if (element) {
    if (element.tagName.toLocaleLowerCase() == "section") {
      const slide = element.children[0];
      const slideNumber = parseInt(slide.getAttribute("number")) || 1;
      Delta.goToSlide(slideNumber);
    } else {
      const slide = element.findParentByTagName("slide");
      const slideNumber = parseInt(slide.getAttribute("number")) || 1;
      Delta.goToSlide(slideNumber);
    }
  }
};

Delta.environmentBuilder = function (envElement, number) {
  envElement.classList.add("environment");
  const envName = envElement.tagName.toLowerCase();
  const title = Array.from(envElement.children).find(
    (child) => child.tagName.toLowerCase() === "title",
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
};

Delta.columnsBuilder = function (columns) {
  const widths = [];
  const columnList = columns.querySelectorAll("column");
  const totalColumns = columnList.length;
  // Getting the widths
  columnList.forEach((column) => {
    if (column.parentElement === columns) {
      widths.push(parseInt(column.getAttribute("width") || 0));
    }
  });
  // Computing the width of unspecified columns
  const totalWidth = widths.reduce((acc, cv) => acc + cv, 0);
  const diff = 100 - totalWidth;
  const nonWidths = widths.reduce((acc, cv) => (acc += cv == 0 ? 1 : 0), 0);
  if (nonWidths > 0) {
    widths.forEach((w, i) => {
      widths[i] = w == 0 ? diff / nonWidths : w;
    });
  }
  const gridTemplate = widths.join("% ") + "%";
  columns.style.display = "grid";
  columns.style["grid-template-columns"] = gridTemplate;
  columns.style["gap"] = "var(--columns-gap)";
};

Delta.blockquoteBuilder = function (quote) {
  if (quote.getAttribute("source")) {
    const sourceElement = document.createElement("div");
    sourceElement.classList.add("align-right");
    sourceElement.innerHTML = quote.getAttribute("source");
    quote.appendChild(sourceElement);
  }
};

Delta.getSlideFromURL = function () {
  const url = new URL(window.location.href);
  const urlParams = new URLSearchParams(url.search);
  return parseInt(urlParams.get("slide"));
};

Delta.stepForward = function () {
  const steps = document
    .getElementById(`DELTA_SLIDE_${Delta.state.currentSlide}`)
    .querySelectorAll(".step");
  if (steps.length > 0) {
    steps[0].classList.remove("step");
    steps[0].classList.add("activeStep");
  } else {
    Delta.goToSlide(parseInt(Delta.state.currentSlide) + 1);
  }
};

Delta.stepBack = function () {
  const activatedSteps = document
    .getElementById(`DELTA_SLIDE_${Delta.state.currentSlide}`)
    .querySelectorAll(".activeStep");

  if (activatedSteps.length > 0) {
    activatedSteps[activatedSteps.length - 1].classList.remove("activeStep");

    activatedSteps[activatedSteps.length - 1].classList.add("step");
  } else {
    Delta.goToSlide(Delta.state.currentSlide - 1);
  }
};

Delta.showToolTip = function (event) {
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
};

Delta.hideToolTip = function () {
  document.getElementById("tool_tip_element").style.display = "none";
};

Delta.handleReferenceClick = function (event) {
  const targetId = event.target.getAttribute("to");
  const target = document.getElementById(targetId);
  if (target) {
    const slideNumber = target
      .findParentByTagName("slide")
      .getAttribute("number");
    Delta.goToSlide(slideNumber);
  }
};

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
