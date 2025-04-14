class FunctionPlot extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.chart = null;
    this.app = Delta.getInstance();
    // Bind the handler to the proper context
    this.handleStateChange = this.handleStateChange.bind(this);
  }

  connectedCallback() {
    this.render();

    // Listen for change in the current slide or total slides
    this.app.eventDispatcher.on(
      "stateChange:currentSlide",
      this.handleStateChange.bind(this),
    );
  }

  // This method is called when the slide changes
  handleStateChange(event) {
    // Determine if our element is now visible.
    if (this.offsetParent !== null) {
      setTimeout(() => {
        // Retrieve the canvas
        const canvas = this.shadowRoot.querySelector("canvas");

        // If the chart already exists, destroy it before creating a new one.
        if (this.chart) {
          this.chart.destroy();
        }

        // Re-render the chart
        // TODO: this should be a temporary solution. I dont want to rerender the chart every time the user enters the slide
        this.renderChart(canvas);
      }, 50);
    }
  }
  renderChart(canvas) {
    // Generate data points and configuration
    const functionExpression = this.getAttribute("function") || "x";
    const xMin = parseFloat(this.getAttribute("xmin"));
    const xMax = parseFloat(this.getAttribute("xmax"));
    const step = parseFloat(this.getAttribute("step"));
    const color = this.getAttribute("color") || "orange";
    const data = [];

    for (let x = xMin; x <= xMax; x += step) {
      const y = this.evaluateFunction(functionExpression, x);
      data.push({ x, y });
    }

    // Create a new Chart.js instance and store it in this.chart
    this.chart = new Chart(canvas, {
      type: "line",
      data: {
        datasets: [
          {
            label: `y = ${functionExpression}`,
            data: data,
            showLine: true,
            fill: false,
            borderColor: color,
            backgroundColor: "transparent",
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: "linear",
            position: "bottom",
            title: { display: true, text: "x" },
          },
          y: {
            title: { display: true, text: "y" },
          },
        },
      },
    });
  }
  static get observedAttributes() {
    return ["function", "xmin", "xmax", "step", "color"];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    // Clear shadow DOM
    this.shadowRoot.innerHTML = "";

    // Add CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./library/plugins/functionPlot/functionPlot.css";
    this.shadowRoot.appendChild(link);

    // Get attributes
    const functionExpression = this.getAttribute("function") || "x";
    const xMin = parseFloat(this.getAttribute("xmin"));
    const xMax = parseFloat(this.getAttribute("xmax"));
    const step = parseFloat(this.getAttribute("step"));
    const color = this.getAttribute("color") || "orange";

    // Create a canvas
    const canvas = document.createElement("canvas");
    this.shadowRoot.appendChild(canvas);

    if (this.getAttribute("show-controls") === "true") {
      const controls = this.renderControls(
        functionExpression,
        xMin,
        xMax,
        step,
      );
      this.shadowRoot.append(controls);
    }

    this.renderChart(canvas);
  }

  renderControls(funValue, xminValue, xmaxValue, stepValue) {
    // Controls code as before
    const container = document.createElement("div");
    const func = document.createElement("input");
    func.type = "text";
    func.value = funValue || "x";
    func.classList.add("function-plot-func-expression");

    const xmin = document.createElement("input");
    xmin.type = "number";
    xmin.value = xminValue;
    xmin.classList.add("function-plot-generic-input");

    const xmax = document.createElement("input");
    xmax.type = "number";
    xmax.value = xmaxValue;
    xmax.classList.add("function-plot-generic-input");

    const step = document.createElement("input");
    step.type = "number";
    step.value = stepValue;
    step.classList.add("function-plot-generic-input");

    const send = document.createElement("button");
    send.textContent = "Ok";
    const funcPlot = this;
    send.addEventListener("click", () => {
      funcPlot.setAttribute("function", func.value);
      funcPlot.setAttribute("xmin", xmin.value);
      funcPlot.setAttribute("xmax", xmax.value);
      funcPlot.setAttribute("step", step.value);
    });

    container.appendChild(func);
    container.appendChild(xmin);
    container.appendChild(xmax);
    container.appendChild(step);
    container.appendChild(send);

    return container;
  }

  evaluateFunction(expression, x) {
    return eval(expression.replace(/x/g, `(${x})`));
  }
}

// Define the custom element after the framework is ready
Delta.getInstance().eventDispatcher.on("deltaIsReady", () => {
  customElements.define("function-plot", FunctionPlot);
});
