const Reference = {};
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

Reference.createReferenceClass = function (
  mousemoveCallback,
  mouseoutCallback,
  clickCallback,
) {
  return class extends HTMLElement {
    constructor() {
      super();
      this.classList.add("ref");
      this.innerHTML += "<span></span>";
      this.observer = null;
      this.classList.add("ref");
      this.addEventListener("mousemove", () => {
        mousemoveCallback(this.getAttribute("to"));
      });
      this.addEventListener("mouseout", () => {
        mouseoutCallback(this.getAttribute("to"));
      });
      this.addEventListener("click", () => {
        clickCallback(this.getAttribute("to"));
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
        const envNameElement = target.querySelector(".environment-name");
        const envName = envNameElement
          ? envNameElement.innerHTML.slice(0, -2)
          : "";
        const span = this.querySelector("span");
        if (span) {
          const tagName = this.tagName.toLowerCase();
          if (tagName == "a-ref") {
            span.innerText = ` ${envName}`;
          } else {
            const eqNumber = this.findEquationTag(targetId);
            if (eqNumber) span.appendChild(eqNumber);
          }
        }
      }
    }
  };
};

Reference.createEqRefClass = function (
  mousemoveCallback,
  mouseoutCallback,
  clickCallback,
) {
  return class extends HTMLElement {
    constructor() {
      super();
      this.classList.add("ref");
      this.innerHTML += "<span></span>";
      this.observer = null;
      this.classList.add("ref");
      this.addEventListener("mousemove", () => {
        mousemoveCallback(this.getAttribute("to"));
      });
      this.addEventListener("mouseout", () => {
        mouseoutCallback(this.getAttribute("to"));
      });
      this.addEventListener("click", () => {
        clickCallback(this.getAttribute("to"));
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
      } else if (document.getElementById(`mjx-eqn-${id}`)) {
        const spanTarget = document.getElementById(`mjx-eqn-${id}`);
        this.observer = new MutationObserver(() => this.render());
        this.observer.observe(spanTarget, {
          attributes: true,
          childList: true,
        });
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
        const envNameElement = target.querySelector(".environment-name");
        const envName = envNameElement
          ? envNameElement.innerHTML.slice(0, -2)
          : "";
        const span = this.querySelector("span");
        if (span) {
          const tagName = this.tagName.toLowerCase();
          if (tagName == "a-ref") {
            span.innerText = ` ${envName}`;
          } else {
            const eqNumber = this.findEquationTag(targetId);
            if (eqNumber) span.appendChild(eqNumber);
          }
        }
      } else {
        const spanEq = document.getElementById(`mjx-eqn-${targetId}`);
        if (spanEq) {
          const spanEqClone = spanEq.cloneNode({ deep: true });
          const span = this.querySelector("span");
          if (span) {
            span.appendChild(spanEqClone);
          }
        }
      }
    }
  };
};
