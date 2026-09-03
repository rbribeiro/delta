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

function format_number(val) {
    if (Math.abs(val) < 1e-10) return "0";
    return parseFloat(val.toFixed(6)).toString();
}

// Grid Default Settings
const BASE_SCALE = 40;
const TARGET_GRID_SPACING = 50;
const GRID_LINE_COLOR = "rgba(128, 128, 128, 0.12)";
const GRID_LINE_WIDTH = 1;
const AXIS_LINE_COLOR = "rgba(128, 128, 128, 0.24)";
const AXIS_LINE_WIDTH = 1;
const AXIS_LABEL_FONT = "10px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const AXIS_LABEL_COLOR = "rgba(40, 40, 40, 0.85)";

// Subcomponents
class DeltaAxis extends HTMLElement {
    build(plot) {
        const validShows = ["true", "false", "x", "y"];
        const showAttr = (this.getAttribute("show") || "true").toLowerCase();
        this.show = validShows.includes(showAttr) ? showAttr : "true";
    }

    bind(plot) {}

    render(ctx, w, h, plot) {
        if (this.show === "false") return;
        const showX = (this.show === "true" || this.show === "x");
        const showY = (this.show === "true" || this.show === "y");

        const scale = BASE_SCALE * plot.zoom;
        const centerX = Math.round(w / 2 + plot.offsetX);
        const centerY = Math.round(h / 2 + plot.offsetY);

        const stepUnit = getNiceStep(TARGET_GRID_SPACING / scale);
        const stepPx = stepUnit * scale;

        ctx.font = AXIS_LABEL_FONT;
        ctx.fillStyle = AXIS_LABEL_COLOR;

        // X-axis markings
        if (showX) {
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            const textY = h - 6;

            const minUnit = Math.floor((-centerX) / stepPx) * stepUnit;
            const maxUnit = Math.ceil((w - centerX) / stepPx) * stepUnit;

            for (let u = minUnit; u <= maxUnit + stepUnit * 0.5; u += stepUnit) {
                const val = parseFloat(u.toFixed(8)) + 0;
                const sx = Math.round(centerX + u * scale);
                if (sx >= 15 && sx <= w - 15) {
                    ctx.fillText(format_number(val), sx, textY);
                }
            }
        }

        // Y-axis markings
        if (showY) {
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            const textX = 8;

            const minUnit = Math.floor((centerY - h) / stepPx) * stepUnit;
            const maxUnit = Math.ceil((centerY) / stepPx) * stepUnit;

            for (let u = minUnit; u <= maxUnit + stepUnit * 0.5; u += stepUnit) {
                const val = parseFloat(u.toFixed(8)) + 0;
                const sy = Math.round(centerY - u * scale);
                if (sy >= 14 && sy <= h - 20) {
                    ctx.fillText(format_number(val), textX, sy);
                }
            }
        }
    }
}

class DeltaGrid extends HTMLElement {
    build(plot) {
        const validShows = ["true", "false", "origin", "basic"];
        const showAttr = (this.getAttribute("show") || "true").toLowerCase();
        this.show = validShows.includes(showAttr) ? showAttr : "true";
    }

    bind(plot) {}

    render(ctx, w, h, plot) {
        if (this.show === "false") return;

        const scale = BASE_SCALE * plot.zoom;
        const centerX = Math.round(w / 2 + plot.offsetX);
        const centerY = Math.round(h / 2 + plot.offsetY);

        // Grid lines
        if (this.show === "true" || this.show === "basic") {
            const stepUnit = getNiceStep(TARGET_GRID_SPACING / scale);
            const stepPx = stepUnit * scale;

            ctx.strokeStyle = GRID_LINE_COLOR;
            ctx.lineWidth = GRID_LINE_WIDTH;

            // Vertical lines
            const startX = ((centerX % stepPx) + stepPx) % stepPx;
            for (let x = startX; x < w; x += stepPx) {
                ctx.beginPath();
                ctx.moveTo(x + 0.5, 0);
                ctx.lineTo(x + 0.5, h);
                ctx.stroke();
            }

            // Horizontal lines
            const startY = ((centerY % stepPx) + stepPx) % stepPx;
            for (let y = startY; y < h; y += stepPx) {
                ctx.beginPath();
                ctx.moveTo(0, y + 0.5);
                ctx.lineTo(w, y + 0.5);
                ctx.stroke();
            }
        }

        // Origin axes
        if (this.show === "true" || this.show === "origin") {
            ctx.strokeStyle = AXIS_LINE_COLOR;
            ctx.lineWidth = AXIS_LINE_WIDTH;

            // X axis
            if (centerY >= 0 && centerY <= h) {
                ctx.beginPath();
                ctx.moveTo(0, centerY + 0.5);
                ctx.lineTo(w, centerY + 0.5);
                ctx.stroke();
            }

            // Y axis
            if (centerX >= 0 && centerX <= w) {
                ctx.beginPath();
                ctx.moveTo(centerX + 0.5, 0);
                ctx.lineTo(centerX + 0.5, h);
                ctx.stroke();
            }
        }
    }
}

// Plot Component
class DeltaPlot extends HTMLElement {
    connectedCallback() {
        if (this.dataset.deltaReady) return;
        this.dataset.deltaReady = "1";

        // Parameters
        const titleAttr = this.getAttribute("title") || "";
        const grabAttr = this.getAttribute("grab") || "true";
        const zoomAttr = this.getAttribute("zoom") || "true";
        this.configAttributes(titleAttr,grabAttr,zoomAttr);
        this.instanceSubcomponents();

        // Processing lifecycle
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
        if (this.title) {
            this.container.append(this.buildHeader());
        }

        // Canvas
        this.canvas = document.createElement("canvas");
        this.canvas.className = "plot-canvas";
        this.ctx = this.canvas.getContext("2d");
        this.container.append(this.canvas);
        this.append(this.container);

        // Subcomponents build
        for (const el of this.elements) {
            el.build(this);
        }
    }

    bind() {
        new ResizeObserver(() => {
            this.resize(); this.render()
        }).observe(this.canvas);

        this.bindGrab();
        this.bindZoom();

        // Subcomponents bind
        for (const el of this.elements) {
            el.bind(this);
        }
    }

    render() {
        if (!this.ctx) return;

        const r = this.canvas.getBoundingClientRect();
        const w = r.width;
        const h = r.height;
        if (w === 0 || h === 0) return;

        this.ctx.clearRect(0, 0, w, h);

        // Subcomponents render
        for (const el of this.elements) {
            el.render(this.ctx, w, h, this);
        }
    }

    configAttributes(titleAttr, grabAttr, zoomAttr) {
        // Title
        this.title = titleAttr;

        // Grabbing
        this.offsetX = 0; this.offsetY = 0;
        this.grab = (grabAttr !== "false");

        // Zoom
        if (zoomAttr === "false") {
            this.zoomEnabled = false;
            this.minZoom = 1;
            this.maxZoom = 1;
        } else if(zoomAttr == "true"){
            this.zoomEnabled = true;
            this.minZoom = 0.25;
            this.maxZoom = 4;
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
        this.zoom = Math.max(Math.min(1,this.maxZoom),this.minZoom);
    }

    instanceSubcomponents(){
        for (const child of this.children) {
            if (child.tagName.toLowerCase().startsWith("delta-")) {
                child.connectedCallback = () => {};
            }
        }

        this.elements = [];

        // Grid
        const gridEl = this.querySelector("delta-grid");
        if (gridEl) {
            this.elements.push(gridEl);
        }

        // Axis
        const axisEl = this.querySelector("delta-axis");
        if (axisEl) {
            this.elements.push(axisEl);
        }
    }

    buildHeader() {
        const headerEl = document.createElement("div");
        headerEl.className = "plot-header";

        const titleEl = document.createElement("span");
        titleEl.className = "plot-title";
        titleEl.textContent = this.title;

        headerEl.append(titleEl);
        return headerEl;
    }

    resize() {
        const r = this.canvas.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(r.width * dpr);
        this.canvas.height = Math.round(r.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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
}

customElements.define("delta-grid", DeltaGrid);
customElements.define("delta-axis", DeltaAxis);
customElements.define("delta-plot", DeltaPlot);