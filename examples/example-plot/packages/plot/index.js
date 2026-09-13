// Plot Component
class DeltaPlot extends HTMLElement {
    connectedCallback() {
        if (this.dataset.deltaReady) return;
        this.dataset.deltaReady = "1";
        this.build();
    }

    build() {
        // Attributes
        let typeAttr = this.getAttribute("type") || "cartesian";
        let grabAttr = this.getAttribute("grab") || "true";
        let zoomAttr = this.getAttribute("zoom") || "true";
        let xAttr = this.getAttribute("x") || "-16,16";
        let yAttr = this.getAttribute("y") || "-9,9";
        let titleAttr = this.getAttribute("title") || "";

        parsePlotAttributes(this, typeAttr, grabAttr, zoomAttr, xAttr, yAttr, titleAttr);
        parseSubcomponentData(this);

        // Main Container
        this.container = document.createElement("div");
        this.container.className = "plot-container";

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

        // Header
        const headerEl = document.createElement("div");
        headerEl.className = "plot-header";
        const titleEl = document.createElement("span");
        titleEl.className = "plot-title";
        titleEl.textContent = this.title || "";
        headerEl.append(titleEl);
        this.container.prepend(headerEl);

        // Other steps
        this.bind();
        this.render();
    }

    bind() {
        new ResizeObserver(() => {
            this.render();
        }).observe(this.canvas);

        // Subcomponents bind
        for (const el of this.elements) {
            el.bind(this);
        }

        this.bindGrab();
        this.bindZoom();
    }

    render() {
        if (!this.ctx) return;
        this.resize();

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

    // Viewport Management
    
    resize() {
        const r = this.canvas.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        const targetW = Math.round(r.width * dpr);
        const targetH = Math.round(r.height * dpr);

        if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
            this.canvas.width = targetW;
            this.canvas.height = targetH;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            if (!this.userInteracted) {
                this.applyInitialBounds(r.width, r.height);
            }
        }
    }

    applyInitialBounds(w, h) {
        if (this.userInteracted || w < 10 || h < 10) return;

        const dx = Math.abs(this.xRange[1] - this.xRange[0]);
        const dy = Math.abs(this.yRange[1] - this.yRange[0]);
        if (dx <= 0 || dy <= 0) return;

        // Fits both x and y ranges on screen
        this.zoom = Math.min(w / (dx * BASE_SIZE_SCALE), h / (dy * BASE_SIZE_SCALE));
        this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));

        // Center camera on range midpoints
        const scale = BASE_SIZE_SCALE * this.zoom;
        const xMid = (this.xRange[0] + this.xRange[1]) / 2;
        const yMid = (this.yRange[0] + this.yRange[1]) / 2;
        this.offsetX = -xMid * scale;
        this.offsetY = yMid * scale;
    }

    bindGrab() {
        if (!this.grab) return;
        this.canvas.style.cursor = "grab";

        let isDragging = false;
        let dragStartX = 0, dragStartY = 0;
        let startOffsetX = 0, startOffsetY = 0;
        let activePointerId = null;

        this.canvas.addEventListener("pointerdown", (e) => {
            if (activePointerId !== null) return;
            if (this.elements.some(el => el.isDraggingEntity && el.isDraggingEntity())) return;
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

        this.canvas.addEventListener("wheel", (e) => {
            e.preventDefault();
            this.userInteracted = true;

            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            const r = this.canvas.getBoundingClientRect();
            const cx = e.clientX - r.left - r.width / 2;
            const cy = e.clientY - r.top - r.height / 2;

            this.applyZoom(this.zoom * factor, cx, cy);
        }, { passive: false });

        // Touch pinch-zoom
        let initialPinchDist = null;
        let initialPinchZoom = null;
        let pinchCenter = null;

        this.canvas.addEventListener("touchstart", (e) => {
            if (e.touches.length === 2) {
                this.userInteracted = true;
                const [t1, t2] = e.touches;
                initialPinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                initialPinchZoom = this.zoom;
                const r = this.canvas.getBoundingClientRect();
                pinchCenter = {
                    x: (t1.clientX + t2.clientX) / 2 - r.left - r.width / 2,
                    y: (t1.clientY + t2.clientY) / 2 - r.top - r.height / 2
                };
            }
        }, { passive: true });

        this.canvas.addEventListener("touchmove", (e) => {
            if (e.touches.length === 2 && initialPinchDist !== null) {
                e.preventDefault();
                const [t1, t2] = e.touches;
                const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                const newZoom = initialPinchZoom * (dist / initialPinchDist);
                this.applyZoom(newZoom, pinchCenter.x, pinchCenter.y);
            }
        }, { passive: false });

        const endTouch = () => {
            initialPinchDist = null;
            initialPinchZoom = null;
            pinchCenter = null;
        };
        this.canvas.addEventListener("touchend", endTouch);
        this.canvas.addEventListener("touchcancel", endTouch);
    }

    applyZoom(newZoom, cx, cy) {
        const clampedZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        if (Math.abs(clampedZoom - this.zoom) < 1e-6) return;

        // Shift offsets so cursor remains pinned
        this.offsetX = cx - ((cx - this.offsetX) / this.zoom) * clampedZoom;
        this.offsetY = cy - ((cy - this.offsetY) / this.zoom) * clampedZoom;
        this.zoom = clampedZoom;

        this.render();
    }
}

customElements.define("delta-plot", DeltaPlot);