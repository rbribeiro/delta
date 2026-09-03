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

function getNiceStep(targetStep) {
    const pow10 = Math.pow(10, Math.floor(Math.log10(targetStep)));
    const frac = targetStep / pow10;
    if (frac >= 7.5) return 10 * pow10;
    if (frac >= 3.5) return 5 * pow10;
    if (frac >= 1.5) return 2 * pow10;
    return pow10;
}

// Grid Default Settings
const BASE_SCALE = 40;
const TARGET_GRID_SPACING = 50;
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
        const zoomAttr = this.getAttribute("zoom") || "0.25,4";

        // Attribute settings
        this.offsetX = 0;
        this.offsetY = 0;
        this.grab = (this.grab !== "false");
        if (zoomAttr === "false") {
            this.zoomEnabled = false;
            this.minZoom = 1;
            this.maxZoom = 1;
        } else {
            this.zoomEnabled = true;
            const tuple = parse_tuple(zoomAttr, 2, true);
            if (tuple && tuple[0] > 0 && tuple[1] >= tuple[0]) {
                this.minZoom = tuple[0];
                this.maxZoom = tuple[1];
            } else {
                this.minZoom = 0.25;
                this.maxZoom = 4;
            }
        }
        this.zoom = 1;

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
        this.bindGrab();
        this.bindZoom();
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

    bindGrab() {
        if (!this.grab) return;
        this.canvas.style.cursor = "grab";

        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let startOffsetX = 0;
        let startOffsetY = 0;
        let activePointerId = null;

        this.canvas.addEventListener("pointerdown", (e) => {
            if (activePointerId !== null) return;
            activePointerId = e.pointerId;
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            startOffsetX = this.offsetX;
            startOffsetY = this.offsetY;
            this.canvas.setPointerCapture(e.pointerId);
            this.canvas.style.cursor = "grabbing";
        });

        this.canvas.addEventListener("pointermove", (e) => {
            if (!isDragging || e.pointerId !== activePointerId) return;
            this.offsetX = startOffsetX + (e.clientX - dragStartX);
            this.offsetY = startOffsetY + (e.clientY - dragStartY);
            this.render();
        });

        const stopDrag = (e) => {
            if (e.pointerId !== activePointerId) return;
            isDragging = false;
            activePointerId = null;
            try { this.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
            this.canvas.style.cursor = "grab";
        };

        this.canvas.addEventListener("pointerup", stopDrag);
        this.canvas.addEventListener("pointercancel", stopDrag);
    }

    bindZoom() {
        if (!this.zoomEnabled) return;

        // Desktop mouse wheel zoom
        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            const r = this.canvas.getBoundingClientRect();
            const cx = e.clientX - r.left;
            const cy = e.clientY - r.top;

            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom * factor));
            this.applyZoom(newZoom, cx, cy);
        }, { passive: false });

        // Mobile touch pinch-to-zoom
        const touchPointers = new Map();
        let pinchStartDist = 0;
        let pinchStartZoom = 1;
        let pinchCenter = { x: 0, y: 0 };

        this.canvas.addEventListener("pointerdown", (e) => {
            if (e.pointerType !== "touch") return;
            touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (touchPointers.size === 2) {
                const pts = Array.from(touchPointers.values());
                pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                pinchStartZoom = this.zoom;
                const r = this.canvas.getBoundingClientRect();
                pinchCenter = {
                    x: (pts[0].x + pts[1].x) / 2 - r.left,
                    y: (pts[0].y + pts[1].y) / 2 - r.top
                };
            }
        });

        this.canvas.addEventListener("pointermove", (e) => {
            if (e.pointerType !== "touch" || !touchPointers.has(e.pointerId)) return;
            touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (touchPointers.size === 2 && pinchStartDist > 0) {
                const pts = Array.from(touchPointers.values());
                const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                const factor = dist / pinchStartDist;
                const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, pinchStartZoom * factor));
                this.applyZoom(newZoom, pinchCenter.x, pinchCenter.y);
            }
        });

        const onTouchEnd = (e) => {
            touchPointers.delete(e.pointerId);
            if (touchPointers.size < 2) {
                pinchStartDist = 0;
            }
        };

        this.canvas.addEventListener("pointerup", onTouchEnd);
        this.canvas.addEventListener("pointercancel", onTouchEnd);
    }

    onResize() {
        this.resize();
        this.render();
    }

    applyZoom(newZoom, cx, cy) {
        if (newZoom === this.zoom) return;
        const r = this.canvas.getBoundingClientRect();
        const centerX = r.width / 2 + this.offsetX;
        const centerY = r.height / 2 + this.offsetY;

        const ratio = newZoom / this.zoom;
        this.offsetX = this.offsetX + (cx - centerX) * (1 - ratio);
        this.offsetY = this.offsetY + (cy - centerY) * (1 - ratio);
        this.zoom = newZoom;

        this.render();
    }

    drawGrid(w, h) {
        const scale = BASE_SCALE * this.zoom;
        const centerX = Math.round(w / 2 + this.offsetX);
        const centerY = Math.round(h / 2 + this.offsetY);

        // Adaptive step in Cartesian coordinates (1, 2, 5, 10, etc.)
        const stepUnit = getNiceStep(TARGET_GRID_SPACING / scale);
        const stepPx = stepUnit * scale;

        // Grid lines
        this.ctx.strokeStyle = GRID_LINE_COLOR;
        this.ctx.lineWidth = GRID_LINE_WIDTH;

        // Vertical lines
        const startX = ((centerX % stepPx) + stepPx) % stepPx;
        for (let x = startX; x < w; x += stepPx) {
            this.ctx.beginPath();
            this.ctx.moveTo(x + 0.5, 0);
            this.ctx.lineTo(x + 0.5, h);
            this.ctx.stroke();
        }

        // Horizontal lines
        const startY = ((centerY % stepPx) + stepPx) % stepPx;
        for (let y = startY; y < h; y += stepPx) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y + 0.5);
            this.ctx.lineTo(w, y + 0.5);
            this.ctx.stroke();
        }

        // Origin axes
        this.ctx.strokeStyle = AXIS_LINE_COLOR;
        this.ctx.lineWidth = AXIS_LINE_WIDTH;

        // X axis
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