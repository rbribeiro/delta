class FunctionPlot extends HTMLElement {
  constructor() {
    super();
    // Attach a shadow DOM
    this.attachShadow({ mode: "open" });
  }

  connectedCallback() {
    this.render();
  }

  static get observedAttributes() {
    return ["function", "xmin", "xmax", "step", "color"];
  }

  attributeChangedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = "";
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "./library/plugins/functionPlot/functionPlot.css";
    this.shadowRoot.appendChild(link);
    const functionExpression = this.getAttribute("function") || "x";
    const xMin = parseFloat(this.getAttribute("xmin"));
    const xMax = parseFloat(this.getAttribute("xmax"));
    const step = parseFloat(this.getAttribute("step"));
    const color = this.getAttribute("color") || "orange";

    // Create a canvas for Chart.js to render on
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

  renderControls(funValue, xminValue, xmaxValue, stepValue) {
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
      console.log(func.value);
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
    // TODO: Use math.js for more complex expressions and better syntax
    return eval(expression.replace(/x/g, `(${x})`));
  }
}

// Define the custom element after the DELTA framework is ready
Delta.getInstance().eventDispatcher.on("deltaIsReady", () => {
  customElements.define("function-plot", FunctionPlot);
});
