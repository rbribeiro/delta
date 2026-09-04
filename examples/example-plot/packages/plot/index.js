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

        const scaleX = BASE_SCALE * (plot.zoomX || plot.zoom);
        const scaleY = BASE_SCALE * (plot.zoomY || plot.zoom);
        const centerX = Math.round(w / 2 + plot.offsetX);
        const centerY = Math.round(h / 2 + plot.offsetY);

        ctx.font = AXIS_LABEL_FONT;
        ctx.fillStyle = AXIS_LABEL_COLOR;

        // X-axis markings
        if (showX) {
            const stepUnitX = getNiceStep(TARGET_GRID_SPACING / scaleX);
            const stepPxX = stepUnitX * scaleX;
            const textY = h - 6;

            const minUnit = Math.floor((-centerX) / stepPxX) * stepUnitX;
            const maxUnit = Math.ceil((w - centerX) / stepPxX) * stepUnitX;

            for (let u = minUnit; u <= maxUnit + stepUnitX * 0.5; u += stepUnitX) {
                const val = parseFloat(u.toFixed(8)) + 0;
                const sx = Math.round(centerX + u * scaleX);
                if (sx >= 0 && sx <= w) {
                    ctx.textBaseline = "bottom";
                    if (sx < 25) {
                        ctx.textAlign = "left";
                        ctx.fillText(format_number(val), Math.max(4, sx), textY);
                    } else if (sx > w - 25) {
                        ctx.textAlign = "right";
                        ctx.fillText(format_number(val), Math.min(w - 4, sx), textY);
                    } else {
                        ctx.textAlign = "center";
                        ctx.fillText(format_number(val), sx, textY);
                    }
                }
            }
        }

        // Y-axis markings
        if (showY) {
            const stepUnitY = getNiceStep(TARGET_GRID_SPACING / scaleY);
            const stepPxY = stepUnitY * scaleY;
            const textX = 8;

            const minUnit = Math.floor((centerY - h) / stepPxY) * stepUnitY;
            const maxUnit = Math.ceil((centerY) / stepPxY) * stepUnitY;

            for (let u = minUnit; u <= maxUnit + stepUnitY * 0.5; u += stepUnitY) {
                const val = parseFloat(u.toFixed(8)) + 0;
                const sy = Math.round(centerY - u * scaleY);
                if (sy >= 0 && sy <= h) {
                    ctx.textAlign = "left";
                    if (sy < 16) {
                        ctx.textBaseline = "top";
                        ctx.fillText(format_number(val), textX, 4);
                    } else if (sy > h - 22) {
                        ctx.textBaseline = "bottom";
                        ctx.fillText(format_number(val), textX, h - 18);
                    } else {
                        ctx.textBaseline = "middle";
                        ctx.fillText(format_number(val), textX, sy);
                    }
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

        const scaleX = BASE_SCALE * (plot.zoomX || plot.zoom);
        const scaleY = BASE_SCALE * (plot.zoomY || plot.zoom);
        const centerX = Math.round(w / 2 + plot.offsetX);
        const centerY = Math.round(h / 2 + plot.offsetY);

        // Grid lines
        if (this.show === "true" || this.show === "basic") {
            ctx.strokeStyle = GRID_LINE_COLOR;
            ctx.lineWidth = GRID_LINE_WIDTH;

            // Vertical lines (X direction)
            const stepUnitX = getNiceStep(TARGET_GRID_SPACING / scaleX);
            const stepPxX = stepUnitX * scaleX;
            const startX = ((centerX % stepPxX) + stepPxX) % stepPxX;
            for (let x = startX; x <= w + 0.5; x += stepPxX) {
                const rx = Math.round(x);
                ctx.beginPath();
                ctx.moveTo(rx + 0.5, 0);
                ctx.lineTo(rx + 0.5, h);
                ctx.stroke();
            }

            // Horizontal lines (Y direction)
            const stepUnitY = getNiceStep(TARGET_GRID_SPACING / scaleY);
            const stepPxY = stepUnitY * scaleY;
            const startY = ((centerY % stepPxY) + stepPxY) % stepPxY;
            for (let y = startY; y <= h + 0.5; y += stepPxY) {
                const ry = Math.round(y);
                ctx.beginPath();
                ctx.moveTo(0, ry + 0.5);
                ctx.lineTo(w, ry + 0.5);
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

        // Attributes
        this.typeAttr = this.getAttribute("type") || "cartesian"
        this.titleAttr = this.getAttribute("title") || "";
        this.grabAttr = this.getAttribute("grab") || "true";
        this.zoomAttr = this.getAttribute("zoom") || "true";
        this.xAttr = this.getAttribute("x") || "";
        this.yAttr = this.getAttribute("y") || "";

        this.configAttributes();
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

    configAttributes() {
        // Type
        switch (this.typeAttr.toLowerCase()){
            case "scatter":
                this.type = "scatter";
                break;
            default:
                this.type = "cartesian";
                break;
        }

        // Title
        this.title = this.titleAttr;

        // Grabbing
        this.offsetX = 0; this.offsetY = 0;
        this.grab = (this.grabAttr !== "false");

        // Zoom
        if (this.zoomAttr === "false") {
            this.zoomEnabled = false;
            this.minZoom = 1;
            this.maxZoom = 1;
        } else if(this.zoomAttr == "true"){
            this.zoomEnabled = true;
            this.minZoom = 0.25;
            this.maxZoom = 4;
        } else {
            this.zoomEnabled = true;
            const tuple = parse_tuple(this.zoomAttr, 2, true);
            if (tuple && tuple[0] > 0 && tuple[1] >= tuple[0]) {
                this.minZoom = tuple[0];
                this.maxZoom = tuple[1];
            } else {
                this.minZoom = 0.25;
                this.maxZoom = 4;
            }
        }
        this.zoom = Math.max(Math.min(1,this.maxZoom),this.minZoom);
        this.zoomX = this.zoom;
        this.zoomY = this.zoom;
        this.minZoomX = this.minZoom;
        this.maxZoomX = this.maxZoom;
        this.minZoomY = this.minZoom;
        this.maxZoomY = this.maxZoom;

        // Visible range bounds (X and Y)
        this.xRange = parse_tuple(this.xAttr, 2, true);
        this.yRange = parse_tuple(this.yAttr, 2, true);
        this.userInteracted = false;
    }

    instanceSubcomponents(){
        for (const child of this.children) {
            if (child.tagName.toLowerCase().startsWith("delta-")) {
                child.connectedCallback = () => {};
            }
        }

        this.elements = [];

        // Grid
        let gridEl = this.querySelector("delta-grid");
        if((this.type === "cartesian" || this.type === "scatter") && !gridEl) gridEl = document.createElement("delta-grid");
        if(gridEl) this.elements.push(gridEl);

        // Axis
        let axisEl = this.querySelector("delta-axis");
        if((this.type === "cartesian" || this.type === "scatter") && !axisEl) axisEl = document.createElement("delta-axis");
        if(axisEl) this.elements.push(axisEl);
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

    applyInitialBounds(w, h) {
        if (this.userInteracted) return;
        if (!this.xRange && !this.yRange) return;
        if (w < 10 || h < 10) return;

        if (this.xRange && this.yRange) {
            const dx = Math.abs(this.xRange[1] - this.xRange[0]);
            const dy = Math.abs(this.yRange[1] - this.yRange[0]);
            if (dx > 0 && dy > 0) {
                this.zoomX = w / (dx * BASE_SCALE);
                this.zoomY = h / (dy * BASE_SCALE);
                if (this.zoomX < this.minZoomX) this.minZoomX = this.zoomX;
                if (this.zoomX > this.maxZoomX) this.maxZoomX = this.zoomX;
                if (this.zoomY < this.minZoomY) this.minZoomY = this.zoomY;
                if (this.zoomY > this.maxZoomY) this.maxZoomY = this.zoomY;

                const scaleX = BASE_SCALE * this.zoomX;
                const scaleY = BASE_SCALE * this.zoomY;
                const xMid = (this.xRange[0] + this.xRange[1]) / 2;
                const yMid = (this.yRange[0] + this.yRange[1]) / 2;
                this.offsetX = -xMid * scaleX;
                this.offsetY = yMid * scaleY;
            }
        } else if (this.xRange) {
            const dx = Math.abs(this.xRange[1] - this.xRange[0]);
            if (dx > 0) {
                this.zoomX = w / (dx * BASE_SCALE);
                this.zoomY = this.zoomX;
                if (this.zoomX < this.minZoomX) this.minZoomX = this.zoomX;
                if (this.zoomX > this.maxZoomX) this.maxZoomX = this.zoomX;
                if (this.zoomY < this.minZoomY) this.minZoomY = this.zoomY;
                if (this.zoomY > this.maxZoomY) this.maxZoomY = this.zoomY;

                const scaleX = BASE_SCALE * this.zoomX;
                const xMid = (this.xRange[0] + this.xRange[1]) / 2;
                this.offsetX = -xMid * scaleX;
                this.offsetY = 0;
            }
        } else if (this.yRange) {
            const dy = Math.abs(this.yRange[1] - this.yRange[0]);
            if (dy > 0) {
                this.zoomY = h / (dy * BASE_SCALE);
                this.zoomX = this.zoomY;
                if (this.zoomX < this.minZoomX) this.minZoomX = this.zoomX;
                if (this.zoomX > this.maxZoomX) this.maxZoomX = this.zoomX;
                if (this.zoomY < this.minZoomY) this.minZoomY = this.zoomY;
                if (this.zoomY > this.maxZoomY) this.maxZoomY = this.zoomY;

                const scaleY = BASE_SCALE * this.zoomY;
                const yMid = (this.yRange[0] + this.yRange[1]) / 2;
                this.offsetX = 0;
                this.offsetY = yMid * scaleY;
            }
        }
    }

    resize() {
        const r = this.canvas.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(r.width * dpr);
        this.canvas.height = Math.round(r.height * dpr);
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (!this.userInteracted) {
            this.applyInitialBounds(r.width, r.height);
        }
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
            this.userInteracted = true;
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
            this.userInteracted = true;
            const r = this.canvas.getBoundingClientRect();
            const cx = e.clientX - r.left;
            const cy = e.clientY - r.top;

            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            const newZoomX = Math.max(this.minZoomX, Math.min(this.maxZoomX, this.zoomX * factor));
            const newZoomY = Math.max(this.minZoomY, Math.min(this.maxZoomY, this.zoomY * factor));
            this.applyZoom(newZoomX, newZoomY, cx, cy);
        }, { passive: false });

        // Mobile touch pinch-to-zoom
        const touchPointers = new Map();
        let pinchStartDist = 0;
        let pinchStartZoomX = 1;
        let pinchStartZoomY = 1;
        let pinchCenter = { x: 0, y: 0 };

        this.canvas.addEventListener("pointerdown", (e) => {
            if (e.pointerType !== "touch") return;
            this.userInteracted = true;
            touchPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (touchPointers.size === 2) {
                const pts = Array.from(touchPointers.values());
                pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                pinchStartZoomX = this.zoomX;
                pinchStartZoomY = this.zoomY;
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
                const newZoomX = Math.max(this.minZoomX, Math.min(this.maxZoomX, pinchStartZoomX * factor));
                const newZoomY = Math.max(this.minZoomY, Math.min(this.maxZoomY, pinchStartZoomY * factor));
                this.applyZoom(newZoomX, newZoomY, pinchCenter.x, pinchCenter.y);
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

    applyZoom(newZoomX, newZoomY, cx, cy) {
        if (newZoomX === this.zoomX && newZoomY === this.zoomY) return;
        const r = this.canvas.getBoundingClientRect();
        const centerX = r.width / 2 + this.offsetX;
        const centerY = r.height / 2 + this.offsetY;

        const ratioX = newZoomX / this.zoomX;
        const ratioY = newZoomY / this.zoomY;
        this.offsetX = this.offsetX + (cx - centerX) * (1 - ratioX);
        this.offsetY = this.offsetY + (cy - centerY) * (1 - ratioY);
        this.zoomX = newZoomX;
        this.zoomY = newZoomY;

        this.render();
    }
}

customElements.define("delta-grid", DeltaGrid);
customElements.define("delta-axis", DeltaAxis);
customElements.define("delta-plot", DeltaPlot);