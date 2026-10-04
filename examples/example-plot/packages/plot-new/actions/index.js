// Attributes & Data Setup
function initPlotAttributes(plot) {
    // Grabbing
    plot.grab = parseOption(plot.getAttribute("grab"),{"true": true,"false": false});
    
    // Plot Type
    plot.type = parseOption(plot.getAttribute("type"), ["cartesian", "points"]);

    // Zoom
    const zoomAttr = plot.getAttribute("zoom") || "true";
    const fallbackZoom = [0.25,4];
    let zoomRange = parseOption(plot.getAttribute("zoom"),{"true": parseTuple(zoomAttr,2,true) || fallbackZoom, "false": [1,1]});

    plot.offsetX = 0; plot.offsetY = 0;
    plot.userInteracted = false;
    plot.minZoom = Math.min(zoomRange[0],1); plot.maxZoom = Math.max(zoomRange[1],1);
    plot.zoomEnabled = (plot.minZoom !== 1 || plot.maxZoom !== 1);
    plot.zoom = 1;

    // Initial axis ranges
    const fallbackX = [-16,16], fallbackY = [-9,9];
    plot.xRange = parseTuple(plot.getAttribute("x"), 2, true) || fallbackX;
    plot.yRange = parseTuple(plot.getAttribute("y"), 2, true) || fallbackY;

    // Authoritative data container
    plot.data = createPlotData(plot, { points: [], functions: [] });
}

// DOM Construction
function createPlotStructure(plot) {
    plot.container = document.createElement("div");
    plot.container.className = "plot-container";

    plot.header = document.createElement("div");
    plot.header.className = "plot-header";

    plot.canvas = document.createElement("canvas");
    plot.canvas.className = "plot-canvas";
    plot.ctx = plot.canvas.getContext("2d");

    plot.container.prepend(plot.header);
    plot.container.append(plot.canvas);
    plot.append(plot.container);
}

// Subcomponents Discovery
function collectPlotSubcomponents(plot) {
    plot.elements = [];

    // Title subcomponent
    const titleEl = plot.querySelector("delta-title");
    if (titleEl) {
        plot.elements.push(titleEl);
    }

    // Grid subcomponent
    let gridEl = plot.querySelector("delta-grid");
    if (!gridEl && (plot.type === "cartesian" || plot.type === "points")) {
        gridEl = document.createElement("delta-grid");
    }
    if (gridEl) plot.elements.push(gridEl);

    // Axis subcomponent
    let axisEl = plot.querySelector("delta-axis");
    if (!axisEl && (plot.type === "cartesian" || plot.type === "points")) {
        axisEl = document.createElement("delta-axis");
    }
    if (axisEl) plot.elements.push(axisEl);

    // Functions
    const functionEls = Array.from(plot.querySelectorAll("delta-function"));
    for (const fn of functionEls) {
        plot.elements.push(fn);
    }

    // Single point instances
    const pointEls = Array.from(plot.querySelectorAll("delta-point"));
    for (const pt of pointEls) {
        plot.elements.push(pt);
    }

    // Points controller
    let pointsEl = plot.querySelector("delta-points");
    if (!pointsEl && (plot.type === "points" || pointEls.length > 0)) {
        pointsEl = document.createElement("delta-points");
    }
    if (pointsEl) plot.elements.push(pointsEl);

    // Clear inner children
    plot.innerHTML = "";
    plot.append(plot.container);
}

// Viewport & Zoom Management
function resizePlotCanvas(plot) {
    const rect = plot.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const dpr = window.devicePixelRatio || 1;
    const targetW = Math.round(rect.width * dpr);
    const targetH = Math.round(rect.height * dpr);

    if (plot.canvas.width !== targetW || plot.canvas.height !== targetH) {
        plot.canvas.width = targetW;
        plot.canvas.height = targetH;
        plot.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        if (!plot.userInteracted) {
            fitInitialBounds(plot, rect.width, rect.height);
        }
    }
}

function fitInitialBounds(plot, w, h) {
    if (plot.userInteracted || w < 10 || h < 10) return;

    const dx = Math.abs(plot.xRange[1] - plot.xRange[0]);
    const dy = Math.abs(plot.yRange[1] - plot.yRange[0]);
    if (dx <= 0 || dy <= 0) return;

    plot.zoom = Math.min(w / (dx * BASE_SIZE_SCALE), h / (dy * BASE_SIZE_SCALE));
    plot.zoom = Math.max(plot.minZoom, Math.min(plot.maxZoom, plot.zoom));

    const scale = BASE_SIZE_SCALE * plot.zoom;
    const xMid = (plot.xRange[0] + plot.xRange[1]) / 2;
    const yMid = (plot.yRange[0] + plot.yRange[1]) / 2;
    plot.offsetX = -xMid * scale;
    plot.offsetY = yMid * scale;
}

function applyZoom(plot, newZoom, cx, cy) {
    const clamped = Math.max(plot.minZoom, Math.min(plot.maxZoom, newZoom));
    if (Math.abs(clamped - plot.zoom) < 1e-6) return;

    // Shift offsets so cursor remains stationary in world space
    plot.offsetX = cx - ((cx - plot.offsetX) / plot.zoom) * clamped;
    plot.offsetY = cy - ((cy - plot.offsetY) / plot.zoom) * clamped;
    plot.zoom = clamped;

    plot.render();
}

// Navigation Events (Pan & Zoom)
function bindPlotPan(plot) {
    if (!plot.grab) return;
    plot.canvas.style.cursor = "grab";

    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let startOffsetX = 0, startOffsetY = 0;
    let activePointerId = null;

    plot.canvas.addEventListener("pointerdown", (e) => {
        if (activePointerId !== null) return;
        if (plot.elements.some(el => el.isDraggingEntity && el.isDraggingEntity())) return;

        activePointerId = e.pointerId;
        isDragging = true;
        plot.userInteracted = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startOffsetX = plot.offsetX;
        startOffsetY = plot.offsetY;

        plot.canvas.setPointerCapture(e.pointerId);
        plot.canvas.style.cursor = "grabbing";
    });

    plot.canvas.addEventListener("pointermove", (e) => {
        if (!isDragging || e.pointerId !== activePointerId) return;
        plot.offsetX = startOffsetX + (e.clientX - dragStartX);
        plot.offsetY = startOffsetY + (e.clientY - dragStartY);
        plot.render();
    });

    const stopDrag = (e) => {
        if (e.pointerId !== activePointerId) return;
        isDragging = false;
        activePointerId = null;
        try { plot.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
        plot.canvas.style.cursor = "grab";
    };

    plot.canvas.addEventListener("pointerup", stopDrag);
    plot.canvas.addEventListener("pointercancel", stopDrag);
}

function bindPlotZoom(plot) {
    if (!plot.zoomEnabled) return;

    plot.canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        plot.userInteracted = true;

        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const rect = plot.canvas.getBoundingClientRect();
        const cx = e.clientX - rect.left - rect.width / 2;
        const cy = e.clientY - rect.top - rect.height / 2;

        applyZoom(plot, plot.zoom * factor, cx, cy);
    }, { passive: false });

    // Touch pinch-zoom
    let pinchDist = null;
    let pinchZoom = null;
    let pinchCenter = null;

    plot.canvas.addEventListener("touchstart", (e) => {
        if (e.touches.length === 2) {
            plot.userInteracted = true;
            const [t1, t2] = e.touches;
            pinchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            pinchZoom = plot.zoom;
            const rect = plot.canvas.getBoundingClientRect();
            pinchCenter = {
                x: (t1.clientX + t2.clientX) / 2 - rect.left - rect.width / 2,
                y: (t1.clientY + t2.clientY) / 2 - rect.top - rect.height / 2
            };
        }
    }, { passive: true });

    plot.canvas.addEventListener("touchmove", (e) => {
        if (e.touches.length === 2 && pinchDist !== null) {
            e.preventDefault();
            const [t1, t2] = e.touches;
            const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            applyZoom(plot, pinchZoom * (dist / pinchDist), pinchCenter.x, pinchCenter.y);
        }
    }, { passive: false });

    const endTouch = () => {
        pinchDist = null;
        pinchZoom = null;
        pinchCenter = null;
    };
    plot.canvas.addEventListener("touchend", endTouch);
    plot.canvas.addEventListener("touchcancel", endTouch);
}

// Rendering Pipeline
function renderPlot(plot) {
    if (!plot.ctx) return;
    resizePlotCanvas(plot);

    const dpr = window.devicePixelRatio || 1;
    plot.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const rect = plot.canvas.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;

    plot.ctx.clearRect(0, 0, w, h);

    for (const el of plot.elements) {
        el.render(plot.ctx, w, h, plot);
    }
}
