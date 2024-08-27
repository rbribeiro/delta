const core = [
  {
    id: "Utils",
    src: "library/core/utils.js",
  },
  {
    id: "Navigation",
    src: "library/core/navigation.js",
  },
  {
    id: "Citation",
    src: "library/core/citation.js",
  },

  {
    id: "TableOfContets",
    src: "library/core/tableOfContents.js",
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

//TODO: add PAUSE attribute
// TODO: math-env/math-block tag
/* <math-env align>
</math-env> */
// TODO: replace title by name/ slide-title
// TODO: tags slide-title, section-title, subsection-title
// TODO: add type attr custom-env

/**
 * EventDispatcher class extends `EventTarget` to provide a simple interface for managing custom events.
 *
 * - `constructor()`: Calls the parent `EventTarget` constructor to initialize the event dispatcher.
 *
 * - `on(eventType, callBack)`: Registers an event listener for the specified `eventType`.
 *   - @param {string} eventType - The type of event to listen for.
 *   - @param {Function} callBack - The function to be called when the event is triggered.
 *
 * - `off(eventType, callBack)`: Removes a previously registered event listener for the specified `eventType`.
 *   - @param {string} eventType - The type of event to stop listening for.
 *   - @param {Function} callBack - The function to be removed from the event listeners.
 *
 * - `trigger(eventType, detail = {})`: Dispatches a custom event with the specified `eventType` and optional `detail`.
 *   - @param {string} eventType - The type of event to be dispatched.
 *   - @param {Object} [detail={}] - Additional data to pass with the event, accessible via `event.detail`.
 */
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
  /**
   * Constructor for the Delta class.
   *
   * @param {Object} config - Configuration object to initialize the Delta instance with custom settings.
   *
   * This constructor checks if an instance of Delta already exists (singleton pattern). If an instance
   * exists, it returns that instance to ensure only one Delta instance is used throughout the application.
   *
   * The provided configuration object is merged into the Delta instance using `Object.assign`. An
   * `EventDispatcher` is initialized to handle custom events within the Delta framework.
   *
   * A tooltip element is created and appended to the document body with the id "DELTA_tooltip" for displaying
   * contextual information during presentations.
   *
   * The constructor sets up event listeners for:
   * - `stateChange:currentSlide`: Triggered when the current slide changes, handled by `onCurrentSlideChange`.
   * - `stateChange:totalSlides`: Triggered when the total number of slides changes, handled by `onTotalSlidesChange`.
   * - `deltaIsReady`: Triggered when the Delta framework is fully initialized, handled by `updateEqRefs`.
   *
   * Finally, the instance is stored in `Delta.instance` for future reference.
   */
  constructor(config) {
    if (Delta.instance) {
      return Delta.instance;
    }
    Object.assign(this, config);
    this.eventDispatcher = new EventDispatcher();
    this.core = core;
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

    this.eventDispatcher.on("deltaIsReady", this.onReady);

    Delta.instance = this;
  }

  /**
   * Asynchronous method to initialize the Delta framework.
   *
   * This method performs the following steps:
   *
   * - Adds the `hidden-overflow` class to the document body to prevent scrolling during initialization.
   *
   * - Attempts to load the core components and plugins using `loadCore()` and `loadPlugins()` methods.
   *   Logs a message once both are successfully loaded.
   *
   * - Creates custom HTML elements specific to the Delta framework using `createCustomElements()`.
   *
   * - Sets up the navigation system by calling `navigation()` and logs the completion.
   *
   * - Renders the initial content by calling the `render()` method.
   *
   * - Uses MathJax to queue up a function that adds `step` classes to certain parts of equations if they
   *   have the `animate` attribute, enabling animations for these elements.
   *
   * - Updates equation references labels via `Delta.instance.updateEqRefs()` after the MathJax queue is processed.
   *
   * - Triggers the `deltaIsReady` event to signal that the Delta framework is fully initialized and ready for use.
   *
   * - Catches and logs any errors that occur during initialization.
   */
  async initialize() {
    document.body.classList.add("hidden-overflow");
    try {
      await this.loadCore();
      await this.loadPlugins();
      console.log("Core and Plugins loaded...");

      this.navigation();
      console.log("Navigation system added");

      this.render();

      this.eventDispatcher.trigger("deltaIsReady");
    } catch (error) {
      console.error(error);
    }
  }

  /**
   * This method selects all unordered (`<ul>`) and ordered (`<ol>`) lists
   * in the document and checks if they have the "animate" attribute.
   * If a list has the "animate" attribute, it iterates through all
   * its `<li>` (list item) elements and adds the "step" class to each.
   *
   * The "step" class can be used to apply CSS animations or styles
   * for list items, allowing them to be revealed or animated step by step.
   */

  animateLists() {
    const lists = document.querySelectorAll("ul, ol");

    if (lists) {
      lists.forEach((list) => {
        if (list.hasAttribute("animate")) {
          const items = list.querySelectorAll("li");
          items.forEach((item) => {
            item.classList.add("step");
          });
        }
      });
    }
  }

  /**
   * Defines and registers custom HTML elements for the Delta framework.
   *
   * This method performs the following tasks:
   *
   * - **Layout Elements:**
   *   - Defines a custom element `column-block` for layout purposes, associated with the `Columns` class.
   *
   * - **Reference Tags:**
   *   - Defines `a-ref` and `eq-ref` elements for referencing, using methods that handle tooltip visibility.
   *   - `a-ref`: Represents a general reference.
   *   - `eq-ref`: Represents an equation reference.
   *
   * - **Environment Tags:**
   *   - Dynamically defines custom elements for each environment specified in `this.environments`.
   *   - For each environment (e.g., `proof-block`, `definition-block`), a corresponding custom element is defined using `MathEnv.createEnvironmentClass(env)`.
   *   - Defines a generic `custom-env` element for user-defined environments.
   *
   * - **Equation Tags:**
   *   - Defines `equation-block` and `align-block` elements for mathematical equations, wrapping LaTeX `\begin` and `\end` tags.
   *
   * - **Bibliography Elements:**
   *   - Defines `bib-item`, `the-bibliography`, and `cite-work` elements to handle bibliography entries and citations.
   *
   * - **Progress Elements:**
   *   - Defines `slide-counter` and `progress-bar` elements to manage presentation progress and slide numbering.
   *
   * This setup ensures that all necessary custom elements are available for use in the Delta framework.
   */
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
    // Define table of content
    customElements.define("table-contents", TableOfContents);
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

    //Bibliography elements
    customElements.define("bib-item", BibItem);
    customElements.define("the-bibliography", Bibliography);
    customElements.define("cite-work", Citation);
    // Progress elements
    customElements.define("slide-counter", SlideCounter);
    customElements.define("progress-bar", ProgressBar);
  }

  /**
   * Enumerates and numbers environment elements based on the selected enumeration style.
   *
   * This method performs the following steps:
   *
   * - Retrieves all elements with the class `environment`.
   * - Depending on the `environmentEnumeration` setting, it numbers the environment elements in one of three ways:
   *
   *   1. **Sequential Numbering (`sequential`):**
   *      - Numbers all `.environment` elements sequentially, skipping those with the `no-number` attribute.
   *
   *   2. **Section-Based Numbering (`section`):**
   *      - Numbers `.environment` elements within each `section` element.
   *      - Numbers are prefixed with the section number, followed by an incrementing number specific to each environment type within that section (e.g., "1.1", "1.2", "2.1").
   *      - Skips elements with the `no-number` attribute.
   *
   *   3. **Default Numbering (used if no specific enumeration style is selected):**
   *      - Numbers all `.environment` elements by type (tag name) across the entire document.
   *      - Skips elements with the `no-number` attribute.
   *
   * This method ensures that all environment elements are consistently numbered according to the specified enumeration style.
   */
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

  /**
   * Enumerates and numbers section, subsection, and subsubsection elements.
   *
   * This method performs the following steps:
   *
   * - Initializes counters for sections, subsections, and subsubsections.
   * - Retrieves all elements with the tags `section`, `subsection`, and `subsubsection`.
   *
   * - Iterates through the retrieved elements and assigns a number based on the element type:
   *
   *   1. **Section (`section`):**
   *      - Increments the section counter.
   *      - Resets the subsection and subsubsection counters.
   *      - Assigns a number to the section (e.g., "1", "2").
   *      - Updates the `h1` title within the section, prepending the section number to it.
   *
   *   2. **Subsection (`subsection`):**
   *      - Increments the subsection counter.
   *      - Resets the subsubsection counter.
   *      - Assigns a number to the subsection in the format `sectionCounter.subsectionCounter` (e.g., "1.1", "1.2").
   *      - Updates the `h2` title within the subsection, prepending the subsection number to it.
   *
   *   3. **Subsubsection (`subsubsection`):**
   *      - Increments the subsubsection counter.
   *      - Assigns a number to the subsubsection in the format `sectionCounter.subsectionCounter.subsubsectionCounter` (e.g., "1.1.1", "1.1.2").
   *
   * This method ensures that sections, subsections, and subsubsections are properly numbered and their titles are updated to reflect their numbering.
   */
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
        element.id = `DELTA_SECTION_${sectionCounter}`;

        const title = element.querySelector("h1");
        if (title) title.innerHTML = `${sectionCounter}. ${title.innerHTML}`;
      } else if (tagName === "subsection") {
        // Increment subsection counter and reset subsubsection counter
        subsectionCounter++;
        subsubsectionCounter = 0;
        element.setAttribute(
          "number",
          `${sectionCounter}.${subsectionCounter}`,
        );
        element.id = `DELTA_SUBSECTION_${sectionCounter}_${subsectionCounter}`;
        const title = element.querySelector("h2");
        if (title)
          title.innerHTML = `${sectionCounter}.${subsectionCounter}. ${title.innerHTML}`;
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

  /**
   * Retrieves the singleton instance of the Delta class.
   *
   * This static method checks if an instance of the Delta class already exists:
   *
   * - If no instance exists (`Delta.instance` is `undefined` or `null`), it creates a new instance by calling the Delta constructor and assigns it to `Delta.instance`.
   *
   * - If an instance already exists, it simply returns the existing instance.
   *
   * This ensures that only one instance of the Delta class is used throughout the application, following the singleton design pattern.
   *
   * @returns {Delta} The singleton instance of the Delta class.
   */
  static getInstance() {
    if (!Delta.instance) {
      Delta.instance = new Delta();
    }

    return Delta.instance;
  }

  /**
   * Retrieves the current slide number from the URL query parameters.
   *
   * This method performs the following steps:
   *
   * - Constructs a `URL` object from the current window's URL.
   * - Extracts the query parameters using `URLSearchParams`.
   * - Retrieves the value of the "slide" parameter from the query string.
   * - Converts the retrieved value to an integer using `parseInt` and returns it.
   *
   * @returns {number} The slide number specified in the URL, or `NaN` if the "slide" parameter is not present or invalid.
   */
  getSlideNumFromURL() {
    const url = new URL(window.location.href);
    const urlParams = new URLSearchParams(url.search);
    return parseInt(urlParams.get("slide"));
  }

  /**
   * Navigates to the specified slide number.
   *
   * This method performs the following steps:
   *
   * - Checks if the provided `slideNumber` is within the valid range:
   *   - It must be greater than 0.
   *   - It must be less than or equal to the total number of slides (`this.state.totalSlides`).
   *
   * - If the `slideNumber` is valid, it updates the application state by setting the `currentSlide` to the specified number.
   *
   * This ensures that the user can only navigate to existing slides within the presentation.
   *
   * @param {number} slideNumber - The slide number to navigate to.
   */
  goToSlide(slideNumber) {
    if (slideNumber <= this.state.totalSlides && slideNumber > 0) {
      this.updateState({ currentSlide: slideNumber });
    }
  }

  /**
   * Hides the tooltip element by setting its display style to "none".
   *
   * This method retrieves the tooltip element with the ID `DELTA_tooltip` and hides it by changing its `display` property to `none`.
   *
   * It is typically used to remove the tooltip from view when it is no longer needed.
   */
  hideToolTip() {
    document.getElementById("DELTA_tooltip").style.display = "none";
  }

  /**
   * Asynchronously loads the core scripts required by the Delta framework, including MathJax configuration.
   *
   * This method performs the following steps:
   *
   * - Creates a `<script>` element to configure MathJax settings:
   *   - Sets `inlineMath` delimiters for inline equations.
   *   - Enables automatic numbering for equations using the AMS style.
   *   - Appends this script to the document's `<head>` to ensure MathJax is configured before it is loaded.
   *
   * - Loads all core scripts defined in `this.core` by returning a `Promise.all` that:
   *   - Iterates over each `plugin` in `this.core`.
   *   - Creates a new `<script>` element for each plugin, setting its `src`, `async`, and `id` attributes.
   *   - Handles the `onload` event to resolve the promise once the script is loaded, or invokes a custom `onload` function if provided by the plugin.
   *   - Handles the `onerror` event to reject the promise if the script fails to load, logging an error message with the plugin ID.
   *   - Appends each script to the document's `<head>` to begin loading.
   *
   * The method returns a promise that resolves when all core scripts are successfully loaded, or rejects if any script fails to load.
   *
   * @returns {Promise<void[]>} A promise that resolves when all core scripts have loaded, or rejects if any script fails to load.
   */
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

  /**
   * Asynchronously loads the plugins required by the Delta framework.
   *
   * This method performs the following steps:
   *
   * - Loads all plugins defined in `this.plugins` by returning a `Promise.all` that:
   *   - Iterates over each `plugin` in `this.plugins`.
   *   - Creates a new `<script>` element for each plugin, setting its `src`, `async`, and `id` attributes.
   *   - Handles the `onload` event to resolve the promise once the script is loaded, or invokes a custom `onload` function if provided by the plugin.
   *   - Handles the `onerror` event to reject the promise if the script fails to load, logging an error message with the plugin ID.
   *   - Appends each script to the document's `<head>` to begin loading.
   *
   * The method returns a promise that resolves when all plugins are successfully loaded, or rejects if any plugin fails to load.
   *
   * @returns {Promise<void[]>} A promise that resolves when all plugins have loaded, or rejects if any plugin fails to load.
   */
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

  /**
   * Sets up navigation controls for the Delta framework when in "presentation" mode.
   *
   * This method performs the following steps:
   *
   * - Checks if the current state type is "presentation". If so, it enables keyboard and browser navigation for slides.
   *
   * - **Keyboard Navigation:**
   *   - Adds an event listener for the `keydown` event.
   *   - If the right arrow key (`ArrowRight`) is pressed, it advances to the next slide by calling `goToSlide()` with the current slide number incremented by 1.
   *   - If the left arrow key (`ArrowLeft`) is pressed, it moves to the previous slide by calling `goToSlide()` with the current slide number decremented by 1.
   *
   * - **Browser Navigation:**
   *   - Adds an event listener for the `popstate` event, which is triggered when the user navigates using the browser's back or forward buttons.
   *   - Retrieves the `slide` parameter from the URL query string.
   *   - Updates the application state to reflect the current slide using `updateState()`.
   *
   * This method ensures that users can navigate through the presentation using both keyboard arrows and browser history controls.
   */
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

  /**
   * Handles the change in the current slide, updating the active slide and URL accordingly.
   *
   * This method performs the following steps:
   *
   * - Retrieves the list of all `slide` elements.
   * - Extracts the old and current slide numbers, as well as the total number of slides, from the event details.
   *
   * - If the `currentSlide` number is within the valid range:
   *   - Activates the new slide by adding the `active` class to the corresponding `slide` element.
   *
   * - Deactivates the old slide by removing the `active` class from the previous `slide` element.
   *
   * - Updates the browser's URL to reflect the new slide number:
   *   - Constructs a new URL object from the current window location.
   *   - Updates the `slide` parameter in the URL query string with the `currentSlide` number.
   *   - Uses `history.pushState()` to add a new entry to the browser's history and `history.replaceState()` to replace the current state, ensuring the URL accurately reflects the current slide.
   *
   * This method ensures that the visible slide is updated in the DOM, and the URL is modified to reflect the current slide state, enabling deep linking and browser navigation.
   *
   * @param {Event} event - The event object containing the old and current slide state details.
   */
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
  /**
   * The `onReady` method is designed to enhance the presentation of mathematical equations
   * on the page, particularly those contained within custom elements such as `<equation-block>`
   * and `<align-block>`. When invoked, this method performs the following tasks:
   *
   * 1. It waits until MathJax has completed its processing of the page's mathematical content.
   * 2. It then searches for all instances of `equation-block` and `align-block` elements.
   * 3. For each element that has the `animate` attribute, it further inspects the rendered
   *    MathJax content within, specifically looking for atomic elements (`.mjx-texatom`).
   * 4. If these atomic elements are part of a MathJax row (`.mjx-mrow`), it adds a `step` class
   *    to them. This class is used to apply animations or other visual effects to the
   *    equations, making them appear in a stepwise or animated manner.
   * 5. Finally, the method updates all equation references on the page to ensure they are correctly
   *    labeled and synchronized with the displayed equations.
   *
   * This method ensures that animated equations are rendered correctly and that all references
   * to equations are up-to-date, contributing to a dynamic and interactive presentation of mathematical
   * content.
   */
  onReady() {
    // Add step classes to the equations for animation
    MathJax.Hub.Queue(function () {
      const equations = document.querySelectorAll(
        "equation-block, align-block",
      );
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
      //Update the label of the equation references
      Delta.instance.updateEqRefs();
    });
  }
  /**
   * Handles changes in the total number of slides, updating each slide's ID and number attribute.
   *
   * This method performs the following steps:
   *
   * - Retrieves all `slide` elements from the document. If no slides are found, an empty array is returned.
   *
   * - Iterates over each slide, assigning a unique ID and number to it:
   *   - The ID is set in the format `DELTA_SLIDE_X`, where `X` is the slide's position in the sequence (1-based index).
   *   - The `number` attribute is set to the slide's sequential number.
   *
   * This ensures that each slide is correctly numbered and has a unique ID, which can be used for identification and navigation purposes.
   *
   * @param {Event} event - The event object containing details about the total slides change.
   */
  onTotalSlidesChange(event) {
    const slides = document.querySelectorAll("slide") || [];
    slides.forEach((slide, key) => {
      slide.id = `DELTA_SLIDE_${key + 1}`;
      slide.setAttribute("number", key + 1);
    });
  }

  render() {
    this.createCustomElements();
    console.log("Custom Elements created..");

    const currentSlide =
      this.getSlideNumFromURL() || this.state.currentSlide || 1;

    const totalSlides = document.querySelectorAll("slide").length;
    console.log(totalSlides);

    this.animateLists();
    console.log("Lists rendered...");

    this.enumerateEnvironments();
    console.log("Environments enumerated...");

    if (this.type == "paper") {
      this.enumerateSections();
      console.log("Sections enumerated...");
    }

    const pauseElements = document.querySelectorAll("[pause]");
    pauseElements.forEach((el) => {
      el.classList.add("step");
    });

    this.updateState({ currentSlide, totalSlides });
  }

  /**
   * Displays a tooltip with the content of a specified element or MathJax equation.
   *
   * This method performs the following steps:
   *
   * - Retrieves the target element by its `id` and clears any existing content in the tooltip (`DELTA_tooltip`).
   * - If the target element is found, it clones the element (without its ID) and appends it to the tooltip.
   * - If the target element is not found, it checks if the reference is pointing to a MathJax element:
   *   - Searches for a MathJax equation element by its ID (`mjx-eqn-{id}`).
   *   - If found, it clones the equation element (without its ID) and appends it to the tooltip.
   *
   * - The tooltip is made visible by adding the `tooltip` class and setting its `display` style to "block".
   * - All child elements within the tooltip have their `step` and `activeStep` classes removed to avoid interfering with animations.
   *
   * - Positions the tooltip near the mouse cursor (`event.pageX` and `event.pageY`):
   *   - If the tooltip would extend beyond the viewport, its position is adjusted to ensure it remains fully visible within the window.
   *
   * @param {string} id - The ID of the element to be displayed in the tooltip.
   */
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

  /**
   * Updates all equation references (`eq-ref` elements) in the document.
   *
   * This method performs the following steps:
   *
   * - Retrieves all `eq-ref` elements in the document using `querySelectorAll`.
   * - Iterates through each `eq-ref` element and calls its `render()` method to update its content.
   *
   * This ensures that all equation references are correctly rendered and up-to-date, reflecting any changes made to the equations they reference.
   */
  updateEqRefs() {
    const eqRefs = document.querySelectorAll("eq-ref");
    eqRefs.forEach((eqRef) => {
      eqRef.render();
    });
  }

  /**
   * Updates the application state with new values and dispatches events for changed properties.
   *
   * This method performs the following steps:
   *
   * - Creates a `changedProperties` object to track properties that have changed.
   * - Clones the current state (`oldState`) to capture its values before making any changes.
   *
   * - Iterates through each key in the `newState` object:
   *   - Compares the value of each key in `newState` with the current state.
   *   - If a value has changed, it updates the current state and adds the key-value pair to `changedProperties`.
   *
   * - After updating the state, it dispatches a custom event for each changed property:
   *   - The event is named `stateChange:{key}`, where `{key}` is the name of the changed property.
   *   - The event's `detail` object contains the `currentState` (updated state) and `oldState` (previous state).
   *   - The event is configured to bubble up through the DOM and be composed, allowing it to cross shadow DOM boundaries if necessary.
   *
   * This method ensures that the application state is updated in a controlled manner and that other parts of the application are notified of state changes through custom events.
   *
   * @param {Object} newState - An object containing the new state values to be applied.
   */
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
