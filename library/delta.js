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

// TODO: Check events and order in which things are being rendered

class Delta {
  constructor(config) {
    if (Delta.instance) {
      return Delta.instance;
    }
    Object.assign(this, config);
    this.eventDispatcher = new EventDispatcher();
    this.core = [
      {
        id: "Utils",
        src: "library/core/utils.js",
      },
      {
        id: "Navigation",
        src: "library/core/navigation.js",
      },
      {
        id: "ReferenceClass",
        src: "library/core/references.js",
      },
      {
        id: "MathEnv",
        src: "library/core/mathEnvironments.js",
      },
      {
        id: "Progress",
        src: "library/core/progress.js",
      },
      {
        id: "Layout",
        src: "library/core/layout.js",
      },

      {
        id: "MathJax",
        src: "https://cdn.jsdelivr.net/npm/mathjax@2/MathJax.js?config=TeX-AMS_CHTML",
      },
    ];

    const tooltip = document.createElement("div");
    tooltip.id = "DELTA_tooltip";
    document.body.append(tooltip);

    this.eventDispatcher.on(
      "stateChange:currentSlide",
      this.onCurrentSlideChange,
    );
    this.eventDispatcher.on(
      "stateChange:totalSlides",
      this.onTotalSlidesChange,
    );

    this.eventDispatcher.on("deltaIsReady", this.updateEqRefs);

    Delta.instance = this;
  }

  async initialize() {
    try {
      await this.loadCore();
      await this.loadPlugins();
      console.log("Core and Plugins loaded...");

      this.createCustomElements();
      console.log("Math Environment created..");

      this.navigation();
      console.log("Navigation system added");

      this.render();

      // Add step classes to the equations for animation
      MathJax.Hub.Queue(function () {
        const equations = document.querySelectorAll("equation-block");
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
        Delta.instance.updateEqRefs();
      });

      this.eventDispatcher.trigger("deltaIsReady");
    } catch (error) {
      console.error(error);
    }
  }

  createCustomElements() {
    // Layout Elements
    customElements.define("column-block", Columns);
    // Defining reference tags
    customElements.define(
      "a-ref",
      Reference.createReferenceClass(this.showToolTip, this.hideToolTip),
    );
    customElements.define(
      "eq-ref",
      Reference.createEqRefClass(this.showToolTip, this.hideToolTip),
    );
    // Defining environment tags
    // environment-name-block
    this.environments.forEach((env) => {
      customElements.define(
        `${env}-block`,
        MathEnv.createEnvironmentClass(env),
      );
    });
    // Define the custom environment tag
    customElements.define("custom-env", MathEnv.createEnvironmentClass());
    // Defining equation tags
    customElements.define(
      "equation-block",
      MathEnv.createEquationClass("\\begin{equation}", "\\end{equation}"),
    );
    customElements.define(
      "align-block",
      MathEnv.createEquationClass("\\begin{align}", "\\end{align}"),
    );

    // Progress elements
    customElements.define("slide-counter", SlideCounter);
    customElements.define("progress-bar", ProgressBar);
  }

  enumerateEnvironments() {
    const envList = document.querySelectorAll(".environment");
    if (envList.length > 0) {
      switch (this.environmentEnumeration) {
        case "sequential":
          envList.forEach((env, key) => {
            if (!env.hasAttribute("no-number")) {
              env.setAttribute("number", key + 1);
            }
          });

          break;

        case "section":
          const sections = document.querySelectorAll("section");
          if (sections.length > 0) {
            sections.forEach((section, key) => {
              const envSecList = section.querySelectorAll(".environment");

              if (envSecList.length > 0) {
                const counters = {};
                envSecList.forEach((env) => {
                  if (!counters[env.tagName]) {
                    counters[env.tagName] = 0;
                  }

                  if (!env.hasAttribute("no-number")) {
                    counters[env.tagName]++;
                    env.setAttribute(
                      "number",
                      `${key + 1}.${counters[env.tagName]}`,
                    );
                  }
                });
              }
            });
          }
          break;

        default:
          const counters = {};
          envList.forEach((env) => {
            if (!counters[env.tagName]) {
              counters[env.tagName] = 0;
            }

            if (!env.hasAttribute("no-number")) {
              counters[env.tagName]++;
              env.setAttribute("number", counters[env.tagName]);
            }
          });
          break;
      }
    }
  }

  enumerateSections() {
    // Initialize counters
    let sectionCounter = 0;
    let subsectionCounter = 0;
    let subsubsectionCounter = 0;
    const elements = document.querySelectorAll(
      "section, subsection, subsubsection",
    );

    elements.forEach((element) => {
      const tagName = element.tagName.toLowerCase();

      if (tagName === "section") {
        // Increment section counter and reset others
        sectionCounter++;
        subsectionCounter = 0;
        subsubsectionCounter = 0;
        element.setAttribute("number", `${sectionCounter}`);
        const title = element.querySelector("h1");
        if (title) title.innerHTML = `${sectionCounter} ${title.innerHTML}`;
      } else if (tagName === "subsection") {
        // Increment subsection counter and reset subsubsection counter
        subsectionCounter++;
        subsubsectionCounter = 0;
        element.setAttribute(
          "number",
          `${sectionCounter}.${subsectionCounter}`,
        );
        const title = element.querySelector("h2");
        if (title)
          title.innerHTML = `${sectionCounter}.${subsectionCounter} ${title.innerHTML}`;
      } else if (tagName === "subsubsection") {
        // Increment subsubsection counter
        subsubsectionCounter++;
        element.setAttribute(
          "number",
          `${sectionCounter}.${subsectionCounter}.${subsubsectionCounter}`,
        );
      }
    });
  }
  static getInstance() {
    if (!Delta.instance) {
      Delta.instance = new Delta();
    }

    return Delta.instance;
  }

  getSlideNumFromURL() {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    return parseInt(urlParams.get("slide"));
  }

  goToSlide(slideNumber) {
    if (slideNumber <= this.state.totalSlides && slideNumber > 0) {
      this.updateState({ currentSlide: slideNumber });
    }
  }
  hideToolTip() {
    document.getElementById("DELTA_tooltip").style.display = "none";
  }
  async loadCore() {
    const mathJaxConfig = document.createElement("script");

    mathJaxConfig.type = "text/x-mathjax-config";
    mathJaxConfig[window.opera ? "innerHTML" : "text"] =
      "MathJax.Hub.Config({\n" +
      "  tex2jax: { inlineMath: [['$','$'], ['\\\\(','\\\\)']] },\n" +
      "TeX: { equationNumbers: { autoNumber: 'AMS' } }\n" +
      "});";
    document.head.appendChild(mathJaxConfig);

    return Promise.all(
      this.core.map((plugin) => {
        return new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = plugin.src;
          script.async = true;
          script.id = plugin.id;
          script.onload = plugin.onload || resolve;
          script.onerror = () => {
            console.error(`Failed to load core ${plugin.id}`);
            reject(new Error(`Failed to load core ${plugin.id}`));
          };
          document.head.appendChild(script);
        });
      }),
    );
  }
  async loadPlugins() {
    return Promise.all(
      this.plugins.map((plugin) => {
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
  }

  navigation() {
    if (this.state.type == "presentation") {
      document.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight") {
          this.goToSlide(this.state.currentSlide + 1);
        } else if (e.key === "ArrowLeft") {
          this.goToSlide(this.state.currentSlide - 1);
        }
      });

      window.addEventListener("popstate", (e) => {
        const url = new URL(window.location.href);
        const urlParams = new URLSearchParams(url.search);
        const currentSlide = parseInt(urlParams.get("slide")) || 1;

        this.updateState({ currentSlide });
      });
    }
  }

  onCurrentSlideChange(event) {
    const slides = document.querySelectorAll("slide");
    const oldSlide = event.detail.oldState.currentSlide;
    const currentSlide = event.detail.currentState.currentSlide;
    const totalSlides = event.detail.currentState.totalSlides;

    if (currentSlide > 0 && currentSlide <= totalSlides)
      slides[currentSlide - 1].classList.add("active");

    if (oldSlide > 0) slides[oldSlide - 1].classList.remove("active");

    const url = new URL(window.location.href);
    window.history.pushState({ path: url.href }, "", url.href);
    url.searchParams.set("slide", currentSlide);
    window.history.replaceState({}, "", url);
  }

  onTotalSlidesChange(event) {
    const slides = document.querySelectorAll("slide") || [];
    slides.forEach((slide, key) => {
      slide.id = `DELTA_SLIDE_${key + 1}`;
      slide.setAttribute("number", key + 1);
    });
  }

  render() {
    document.body.classList.add("hidden-overflow");
    const currentSlide =
      this.getSlideNumFromURL() || this.state.currentSlide || 1;

    const totalSlides = document.querySelectorAll("slide").length;

    this.enumerateEnvironments();

    if (this.type == "paper") {
      this.enumerateSections();
    }

    this.updateState({ currentSlide, totalSlides });
  }

  showToolTip(id) {
    let target = document.getElementById(id);
    const tooltip = document.getElementById("DELTA_tooltip");
    tooltip.innerHTML = "";
    if (target) {
      const targetElement = document.getElementById(id).cloneNode(true);
      targetElement.id = "";
      tooltip.append(targetElement);
    } else {
      // the reference might be pointing to a MathJax element
      target = document.getElementById(`mjx-eqn-${id}`);
      if (target) {
        const eqElement = target.findParentByClass("equation");
        if (eqElement) {
          const eq = eqElement.cloneNode(true);
          eq.id = "";
          tooltip.append(eq);
        }
      }
    }

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

  updateEqRefs() {
    const eqRefs = document.querySelectorAll("eq-ref");
    eqRefs.forEach((eqRef) => {
      eqRef.render();
    });
  }

  updateState(newState) {
    const changedProperties = {};
    const oldState = { ...this.state };

    for (const key in newState) {
      if (newState[key] != this.state[key]) {
        changedProperties[key] = newState[key];
        this.state[key] = newState[key];
      }
    }
    //Dispatching events now that all the state has been
    // updated
    for (const key in changedProperties) {
      const event = new CustomEvent(`stateChange:${key}`, {
        detail: { currentState: this.state, oldState: oldState },
        bubbles: true,
        composed: true,
      });

      this.eventDispatcher.dispatchEvent(event);
    }
  }
}

const deltaApp = new Delta(deltaConfig);
deltaApp.initialize();
