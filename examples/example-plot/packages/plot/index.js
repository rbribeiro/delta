// Auxiliary Functions

function parse_tuple(tuple, k = 0, numbers = true) {
    if (tuple == null) return null;
    const parts = tuple.split(',');
    if (k > 0 && parts.length !== k) {
        return null;
    }

    if (numbers) {
        const nums = parts.map(el => parseFloat(el.trim()));
        if (nums.some(num => isNaN(num))) {
            return null;
        }
        return nums;
    } else {
        return parts;
    }
}

// Subcomponents

class PlotHeader {
    constructor(title) {
        this.title = title;
    }

    build() {
        this.el = document.createElement("div");
        this.el.className = "plot-header";

        this.titleEl = document.createElement("span");
        this.titleEl.className = "plot-title";
        this.titleEl.textContent = this.title;

        this.el.append(this.titleEl);
        return this.el;
    }
}

// Plot Component

class DeltaPlot extends HTMLElement {
    connectedCallback() {
        if (this.dataset.deltaReady) return;
        this.dataset.deltaReady = "1";

        // Attributes
        this.title = this.getAttribute("title") || "";

        this.build();
        this.bind();
        this.resize();
        this.render();
    }

    build() {
        this.innerHTML = "";

        // Main Container
        this.container = document.createElement("div");
        this.container.className = "plot-container";

        // Header
        this.header = new PlotHeader(this.title);
        this.container.append(this.header.build());

        // Canvas
        this.canvas = document.createElement("canvas");
        this.canvas.className = "plot-canvas";
        this.ctx = this.canvas.getContext("2d");
        this.container.append(this.canvas);

        this.append(this.container);
    }

    bind() {
        new ResizeObserver(() => this.onResize()).observe(this.canvas);
    }

    onResize() {
        this.resize();
        this.render();
    }

    resize() {
        const r = this.canvas.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(r.width * dpr);
        this.canvas.height = Math.round(r.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    render() {
        if (!this.ctx) return;
        const r = this.canvas.getBoundingClientRect();
        const w = r.width;
        const h = r.height;
        if (w === 0 || h === 0) return;

        this.ctx.clearRect(0, 0, w, h);
    }
}

customElements.define("delta-plot", DeltaPlot);