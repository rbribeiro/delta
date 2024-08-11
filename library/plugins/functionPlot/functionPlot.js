class FunctionPlot extends HTMLElement {
  constructor() {
    super();
    // Attach a shadow DOM
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    const functionExpression = this.getAttribute("function") || "x";
    const xMin = parseFloat(this.getAttribute("xmin"));
    const xMax = parseFloat(this.getAttribute("xmax"));
    const step = parseFloat(this.getAttribute("step"));
    const color = this.getAttribute("color") || "orange";

    // Create a canvas for Chart.js to render on
    const canvas = document.createElement("canvas");
    this.shadowRoot.appendChild(canvas);

    // Generate data points
    const data = [];
    for (let x = xMin; x <= xMax; x += step) {
      const y = this.evaluateFunction(functionExpression, x);
      data.push({ x, y });
    }

    // Plot the data using Chart.js
    new Chart(canvas, {
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
        scales: {
          x: {
            type: "linear",
            position: "bottom",
            title: {
              display: true,
              text: "x",
            },
          },
          y: {
            title: {
              display: true,
              text: "y",
            },
          },
        },
      },
    });
  }

  evaluateFunction(expression, x) {
    // TODO: Use math.js for more complex expressions and better syntax
    return eval(expression.replace(/x/g, `(${x})`));
  }
}

// Define the custom element after the DELTA framework is ready
Delta.getInstance().eventDispatcher.on("deltaIsReady", () => {
  customElements.define("function-plot", FunctionPlot);
});
