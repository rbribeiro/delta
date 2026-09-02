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

// Grid Default Settings
const GRID_STEP = 30;
const GRID_LINE_COLOR = "rgba(128, 128, 128, 0.12)";
const GRID_LINE_WIDTH = 1;
const AXIS_LINE_COLOR = "rgba(60, 60, 60, 0.4)";
const AXIS_LINE_WIDTH = 1.5;

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

        // Parameters
        this.title = this.getAttribute("title") || "";
        this.grab = this.getAttribute("grab") || "true";

        // Attribute settings
        this.offsetX = 0; this.offsetY = 0;
        this.grab = (this.grab !== "false");

        // Processing
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

        if (this.grab) {
            this.canvas.style.cursor = "grab";

            this.canvas.addEventListener("pointerdown", (e) => {
                this.isDragging = true;
                this.dragStartX = e.clientX;
                this.dragStartY = e.clientY;
                this.startOffsetX = this.offsetX;
                this.startOffsetY = this.offsetY;
                this.canvas.setPointerCapture(e.pointerId);
                this.canvas.style.cursor = "grabbing";
            });

            this.canvas.addEventListener("pointermove", (e) => {
                if (!this.isDragging) return;
                this.offsetX = this.startOffsetX + (e.clientX - this.dragStartX);
                this.offsetY = this.startOffsetY + (e.clientY - this.dragStartY);
                this.render();
            });

            const stopDrag = (e) => {
                if (!this.isDragging) return;
                this.isDragging = false;
                try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
                this.canvas.style.cursor = "grab";
            };

            this.canvas.addEventListener("pointerup", stopDrag);
            this.canvas.addEventListener("pointercancel", stopDrag);
        }
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
        const centerX = Math.round(w / 2 + this.offsetX);
        const centerY = Math.round(h / 2 + this.offsetY);
        this.ctx.strokeStyle = GRID_LINE_COLOR;
        this.ctx.lineWidth = GRID_LINE_WIDTH;

        // Vertical lines
        const startX = ((centerX % GRID_STEP) + GRID_STEP) % GRID_STEP;
        for (let x = startX; x < w; x += GRID_STEP) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + 0.5, 0);
            this.ctx.lineTo(x + 0.5, h);
            this.ctx.stroke();
        }

        // Horizontal lines
        const startY = ((centerY % GRID_STEP) + GRID_STEP) % GRID_STEP;
        for (let y = startY; y < h; y += GRID_STEP) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y + 0.5);
            this.ctx.lineTo(w, y + 0.5);
            this.ctx.stroke();
        }

        // Axis
        this.ctx.strokeStyle = AXIS_LINE_COLOR;
        this.ctx.lineWidth = AXIS_LINE_WIDTH;

        // X Axis
        if (centerY >= 0 && centerY <= h) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, centerY + 0.5);
            this.ctx.lineTo(w, centerY + 0.5);
            this.ctx.stroke();
        }

        // Y axis
        if (centerX >= 0 && centerX <= w) {
            this.ctx.beginPath();
            this.ctx.moveTo(centerX + 0.5, 0);
            this.ctx.lineTo(centerX + 0.5, h);
            this.ctx.stroke();
        }
    }
}

customElements.define("delta-plot", DeltaPlot);