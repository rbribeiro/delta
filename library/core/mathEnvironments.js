const MathEnv = {};
/**
 * MathEnv.createEquationClass is a function that generates a custom HTML element class
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
 * const EquationElement = MathEnv.createEquationClass('(', ')');
 * customElements.define('equation-element', EquationElement);
 */
MathEnv.createEquationClass = function (leftWrapper, rightWrapper) {
  return class extends HTMLElement {
    constructor() {
      super();
      this.classList.add("equation");
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

/**
 * MathEnv.createEnvironmentClass is a function that generates a custom HTML element class
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
 * const MathEnvironmentElement = MathEnv.createEnvironmentClass('Theorem');
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
MathEnv.createEnvironmentClass = function (envName) {
  return class extends HTMLElement {
    constructor() {
      super();
    }

    static get observedAttributes() {
      return ["number", "no-number"];
    }

    connectedCallback() {
      this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
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
      const number = this.getAttribute("number")
        ? ` ${this.getAttribute("number")}`
        : "";
      const nameElement = this.querySelector(".environment-name");
      const titleTag = this.querySelector("title");
      const titleElement = this.querySelector(".environment-title");

      if (titleTag) {
        titleElement.innerHTML = titleTag ? `(${titleTag.innerHTML})` : "";
        this.removeChild(titleTag);
      }

      nameElement.innerText = `${name}${number}. `;
    }
  };
};
