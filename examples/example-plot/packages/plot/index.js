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
        this.drawGrid(w, h);
    }

    drawGrid(w, h) {
        const step = 30;
        const centerX = Math.round(w / 2);
        const centerY = Math.round(h / 2);

        // Linhas finas
        this.ctx.strokeStyle = "rgba(128, 128, 128, 0.12)";
        this.ctx.lineWidth = 1;
        
        // Verticais
        for (let x = centerX; x < w; x += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + 0.5, 0);
            this.ctx.lineTo(x + 0.5, h);
            this.ctx.stroke();
        }
        for (let x = centerX - step; x > 0; x -= step) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + 0.5, 0);
            this.ctx.lineTo(x + 0.5, h);
            this.ctx.stroke();
        }

        // Horizontais
        for (let y = centerY; y < h; y += step) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y + 0.5);
            this.ctx.lineTo(w, y + 0.5);
            this.ctx.stroke();
        }
        for (let y = centerY - step; y > 0; y -= step) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y + 0.5);
            this.ctx.lineTo(w, y + 0.5);
            this.ctx.stroke();
        }

        // Eixos principais X e Y
        this.ctx.strokeStyle = "rgba(60, 60, 60, 0.4)";
        this.ctx.lineWidth = 1.5;

        // Eixo X
        this.ctx.beginPath();
        this.ctx.moveTo(0, centerY + 0.5);
        this.ctx.lineTo(w, centerY + 0.5);
        this.ctx.stroke();

        // Eixo Y
        this.ctx.beginPath();
        this.ctx.moveTo(centerX + 0.5, 0);
        this.ctx.lineTo(centerX + 0.5, h);
        this.ctx.stroke();
    }
}

customElements.define("delta-plot", DeltaPlot);