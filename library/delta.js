class EventDispatcher extends EventTarget {
  constructor() {
    super();
  }

  on(eventType, callBack) {
    this.addEventListener(eventType, callBack);
  }

  off(eventType, callBack) {
    this.removeEventListener(eventType, callBack);
  }

  trigger(eventType, detail = {}) {
    this.dispatchEvent(new CustomEvent(eventType, { detail }));
  }
}

Delta.eventDispatcher = new EventDispatcher();

/************************************************************************
 *
 * INIT Function. This is the function that call all the functions the
 * DELTA framework needs to build the presentation
 *
 * ***********************************************************************/

document.addEventListener("DOMContentLoaded", async () => {
  // Dynamically add this class. This is need for the print layout to work
  document.body.classList.add("hidden-overflow");
  // Create tooltip Object
  const tooltip = document.createElement("div");
  tooltip.id = "tool_tip_element";
  document.body.appendChild(tooltip);
  try {
    // loading plugins
    await Delta.loadPlugins(Delta.plugins);
    // Building the native delta elements
    Delta.render(document);

    //add Event Listeners
    Delta.createEventListeners();
    // Add step classes to the equations for animation
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
    const eventBuiltDone = new Event("deltaIsReady");
    Delta.eventDispatcher.trigger("deltaIsReady");
    document.dispatchEvent(eventBuiltDone);
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
};

Delta.loadPlugins = async function (plugins) {
  const mathJaxConfig = document.createElement("script");

  mathJaxConfig.type = "text/x-mathjax-config";
  mathJaxConfig[window.opera ? "innerHTML" : "text"] =
    "MathJax.Hub.Config({\n" +
    "  tex2jax: { inlineMath: [['$','$'], ['\\\\(','\\\\)']] },\n" +
    "TeX: { equationNumbers: { autoNumber: 'AMS' } }\n" +
    "});";
  document.head.appendChild(mathJaxConfig);

  return Promise.all(
    plugins.map((plugin) => {
      return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = plugin.src;
        script.async = true;
        script.id = plugin.id;
        script.onload = plugin.onload || resolve;
        script.onerror = () => {
          console.error(`Failed to load plugin ${plugin.id}`);
          reject(new Error(`Failed to load plugin ${plugin.id}`));
        };
        document.head.appendChild(script);
      });
    }),
  );
};

Delta.render = function (parent) {
  const imgs = parent.querySelectorAll("img") || [];

  imgs.forEach((img, key) => {
    Delta.imgBuilder(img, key);
  });

  Delta.state.environmentList.forEach((env, key) => {
    const envList = parent.querySelectorAll(env) || [];

    envList.forEach((envElement, key) => {
      envElement.setAttribute("name", env);
      Delta.environmentBuilder(envElement, key);
    });
  });

  const columnsList = parent.querySelectorAll("columns") || [];
  columnsList.forEach((columns) => {
    Delta.columnsBuilder(columns);
  });

  const equations = parent.querySelectorAll("equation") || [];
  equations.forEach((eq, key) => {
    Delta.equationBuilder(eq, key + 1);
  });
};

/*****************************************************
 *
 * LISTENERS
 *
 *
 *
 * *************************************************/
Delta.windowListeners = function () {
  window.addEventListener("beforeprint", (e) => {
    document.body.classList.remove("hidden-overflow");
  });

  window.addEventListener("afterprint", () => {
    document.body.classList.add("hidden-overflow");
  });
};

Delta.documentListeners = function () {
  document.addEventListener("stateChange:totalSlides", (e) => {
    const slides = document.querySelectorAll("slide") || [];
    slides.forEach((slide, key) => {
      slide.id = `DELTA_SLIDE_${key + 1}`;
      slide.setAttribute("number", key + 1);
    });

    const currentSlideURL = Delta.getSlideFromURL();
    Delta.goToSlide(currentSlideURL);
  });

  document.addEventListener("deltaIsReady", () => {
    const currentSlide = Delta.getSlideFromURL() || 1;
    Delta.goToSlide(currentSlide);
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

    Delta.eventDispatcher.dispatchEvent(event);
    document.dispatchEvent(event); // needs to be removed latter
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
  const customEnv = document.createElement("custom-env");
  Array.from(envElement.attributes).forEach((attr) => {
    customEnv.setAttribute(attr.name, attr.value);
  });
  while (envElement.firstChild) {
    customEnv.appendChild(envElement.firstChild);
  }

  envElement.replaceWith(customEnv);
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

Delta.showToolTip = function (id) {
  const targetElement = document.getElementById(id).cloneNode(true);
  targetElement.id = "";
  const tooltip = document.getElementById("tool_tip_element");
  if (id) {
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
/**
 * Reference is a custom HTML element class for creating interactive reference links.
 * This class extends HTMLElement and provides functionality for observing a target element,
 * updating its content based on the target's attributes, and handling user interactions.
 *
 * The custom element class provides:
 * - Constructor: Initializes the element by adding a span, setting up event listeners for mouse movements,
 *   mouse out events, and clicks, and adding a class.
 * - observedAttributes: Specifies the attributes to observe for changes ("to").
 * - attributeChangedCallback: Called whenever one of the observed attributes ("to") is changed,
 *   triggering the observeTarget method.
 * - connectedCallback: Called when the element is added to the DOM, triggering an initial render and observing the target.
 * - observeTarget: Sets up a MutationObserver to watch the target element specified by the "to" attribute.
 * - findEquationTag: Searches for an equation tag within the target element and clones it if found.
 * - render: Updates the element's content based on the target element's attributes and child elements.
 *
 * Example usage:
 * <a-ref to="equation1"></reference>
 *
 * The example above creates a reference link that observes the element with id "equation1" and updates its content
 * dynamically based on the target element's state and attributes.
 */
class Reference extends HTMLElement {
  constructor() {
    super();
    this.innerHTML += "<span></span>";
    this.observer = null;
    this.classList.add("ref");
    this.addEventListener("mousemove", () => {
      Delta.showToolTip(this.getAttribute("to"));
    });
    this.addEventListener("mouseout", () => {
      Delta.hideToolTip(this.getAttribute("to"));
    });
    this.addEventListener("click", () => {
      Delta.handleReferenceClick(this.getAttribute("to"));
    });
  }

  static get observedAttributes() {
    return ["to"];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name == "to") {
      this.observeTarget(newValue);
    }
  }

  connectedCallback() {
    this.render();
    const to = this.getAttribute("to");

    if (to) {
      this.observeTarget(to);
    }
  }

  observeTarget(id) {
    if (this.observer) {
      this.observer.disconnect();
    }

    const target = document.getElementById(id);

    if (target) {
      this.observer = new MutationObserver(() => this.render());
      this.observer.observe(target, { attributes: true, childList: true });
      this.render();
    }
  }

  findEquationTag(id) {
    const target = document.getElementById(id);
    if (target) {
      const spans = target.querySelectorAll(".mjx-mtd") || [];

      for (let span of spans) {
        if (span.id.includes("mjx-eqn")) {
          const s = span.cloneNode({ deep: true });
          s.id = "";
          return s;
        }
      }
    }
    return null;
  }

  render() {
    const targetId = this.getAttribute("to");
    const target = document.getElementById(targetId);
    if (target) {
      if (!this.hasAttribute("nonumber")) {
        const n = target.getAttribute("number") || "";
        const span = this.querySelector("span");
        if (span) {
          const tagName = this.tagName.toLowerCase();
          if (tagName == "a-ref") {
            span.innerText = ` ${n}`;
          } else {
            const eqNumber = this.findEquationTag(targetId);
            if (eqNumber) span.appendChild(eqNumber);
          }
        }
      }
    }
  }
}

class EquationReference extends Reference {}

customElements.define("a-ref", Reference);
customElements.define("eq-ref", EquationReference);

/**
 * Delta.createEquationClass is a function that generates a custom HTML element class
 * for handling and rendering mathematical equations. The generated class extends
 * HTMLElement and adds wrappers around the content if they are not already present.
 *
 * @param {string} leftWrapper - The string to be added to the left of the element's content.
 * @param {string} rightWrapper - The string to be added to the right of the element's content.
 * @returns {class} - A custom HTML element class.
 *
 * The generated custom element class:
 * - Checks if the element's inner text already includes the leftWrapper, rightWrapper, or "$$".
 * - If none of these wrappers are present, it wraps the element's content with the leftWrapper and rightWrapper.
 * - The render method is called during the construction of the custom element to ensure the content is properly wrapped.
 *
 * Example usage:
 * const EquationElement = Delta.createEquationClass('(', ')');
 * customElements.define('equation-element', EquationElement);
 */
Delta.createEquationClass = function (leftWrapper, rightWrapper) {
  return class extends HTMLElement {
    constructor() {
      super();
      this.render();
    }

    render() {
      const left = this.innerText.includes(leftWrapper);
      const right = this.innerText.includes(rightWrapper);
      const dollarSign = this.innerText.includes("$$");

      if (!(left || right) && !dollarSign) {
        const nn = this.hasAttribute("no-number");
        this.innerHTML = nn
          ? `$$ ${this.innerHTML} $$`
          : `${leftWrapper} ${this.innerHTML} ${rightWrapper}`;
      }
    }
  };
};

customElements.define(
  "equation-block",
  Delta.createEquationClass("\\begin{equation}", "\\end{equation}"),
);

customElements.define(
  "align-block",
  Delta.createEquationClass("\\begin{align}", "\\end{align}"),
);
/**
 * Delta.createMathEnvironment is a function that generates a custom HTML element class
 * for creating and rendering styled mathematical environments. The generated class extends
 * HTMLElement and ensures that the content is dynamically rendered with the specified environment name.
 *
 * @param {string} envName - The default name for the math environment if not specified by the element's attributes.
 * @returns {class} - A custom HTML element class.
 *
 * The generated custom element class:
 * - Constructor: Calls the superclass constructor to initialize the custom element.
 * - connectedCallback: Called when the element is added to the DOM, triggering the initial render.
 * - render: Dynamically updates the element's content. If the element doesn't already contain the necessary
 *   span elements for the environment name and title, it creates and prepends them. It then sets the content
 *   of the environment name span based on the `envName` parameter or the element's attributes, and processes
 *   any <title> child element to display it within the environment title span.
 *
 * Example usage:
 * const MathEnvironmentElement = Delta.createMathEnvironment('Theorem');
 * customElements.define('math-environment', MathEnvironmentElement);
 *
 * <math-environment number="1">
 *   <title>Title of the theorem</title>
 *   Content of the theorem.
 * </math-environment>
 *
 * The example above would render:
 * Theorem 1. (Title of the theorem) Content of the theorem.
 */
Delta.createMathEnvironment = function (envName) {
  return class extends HTMLElement {
    constructor() {
      super();
    }

    connectedCallback() {
      this.render();
    }

    render() {
      if (!this.querySelector(".environment-name")) {
        const nameElement = document.createElement("span");
        const titleElement = document.createElement("span");
        nameElement.classList.add("environment-name");
        titleElement.classList.add("environment-title");

        this.classList.add("environment");
        this.prepend(titleElement);
        this.prepend(nameElement);
      }
      const name = envName || this.getAttribute("name") || "Math Environment";
      const number = this.getAttribute("number") || "";
      const nameElement = this.querySelector(".environment-name");
      const titleTag = this.querySelector("title");
      const titleElement = this.querySelector(".environment-title");

      if (titleTag) {
        titleElement.innerHTML = titleTag ? `(${titleTag.innerHTML})` : "";
        this.removeChild(titleTag);
      }

      if (nameElement.innerText == "") {
        nameElement.innerText = `${name}${number}. `;
      }
    }
  };
};

customElements.define("custom-env", Delta.createMathEnvironment());
customElements.define("theorem-block", Delta.createMathEnvironment("theorem"));
customElements.define(
  "definition-block",
  Delta.createMathEnvironment("definition"),
);
customElements.define(
  "proposition-block",
  Delta.createMathEnvironment("proposition"),
);
customElements.define("lemma-block", Delta.createMathEnvironment("lemma"));
customElements.define("example-block", Delta.createMathEnvironment("example"));
customElements.define(
  "counter-example-block",
  Delta.createMathEnvironment("counter-example"),
);
