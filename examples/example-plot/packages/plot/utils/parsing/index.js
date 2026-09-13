function parsePlotAttributes(plot, typeAttr, grabAttr, zoomAttr, xAttr, yAttr, titleAttr = "") {
    // Title
    plot.title = titleAttr || "";

    // Grabbing
    plot.grab = (grabAttr !== "false");
    plot.offsetX = 0;
    plot.offsetY = 0;

    // Zoom
    let zoomTuple = parseTuple(zoomAttr, 2, true);
    if (!zoomTuple) {
        zoomTuple = parseTuple(parseOption(zoomAttr, { "true": "0.25,4", "false": "1,1" }), 2, true);
    } else {
        if (zoomTuple[0] > zoomTuple[1] || 1 > zoomTuple[1] || 1 < zoomTuple[0]) zoomTuple = [0.25, 4];
    }
    plot.minZoom = zoomTuple[0];
    plot.maxZoom = zoomTuple[1];
    plot.zoomEnabled = (zoomTuple[0] !== 1 || zoomTuple[1] !== 1);
    plot.zoom = Math.max(Math.min(1, plot.maxZoom), plot.minZoom);

    // Initial Position Range
    plot.xRange = parseTuple(xAttr, 2, true) || [-16, 16];
    plot.yRange = parseTuple(yAttr, 2, true) || [-9, 9];
    plot.userInteracted = false;

    // Plot Type
    plot.type = parseOption(typeAttr, ['cartesian', 'points']);

    // Reactive Authoritative Data Container
    plot.data = createPlotData(plot, { points: [] });
}

function parsePointsAttributes(points, sizeAttr, interactionAttr, plot) {
    // Setup
    const rawSize = parseFloat(sizeAttr);
    points.size = isNaN(rawSize) ? 1 : Math.max(0.1, Math.min(10, rawSize));
    points.interaction = parseOption(interactionAttr, ["true", "false", "move"]);

    points.plot = plot;
    if (!plot.data) plot.data = createPlotData(plot, { points: [] });
    if (!plot.data.points) plot.data.points = [];

    points.mode = false;
    points.selectedId = null;
    points.draggingId = null;
    points.hoverId = null;
    points.dragOffset = { x: 0, y: 0 };
}

function parsePointToData(plot, ptEl) {
    let x = NaN, y = NaN;
    if (ptEl.hasAttribute("x") && ptEl.hasAttribute("y")) {
        x = parseFloat(ptEl.getAttribute("x"));
        y = parseFloat(ptEl.getAttribute("y"));
    } else {
        const tuple = parseTuple(ptEl.getAttribute("pos") || ptEl.textContent?.trim(), 2, true);
        if (tuple) {
            x = tuple[0];
            y = tuple[1];
        }
    }

    if (!isNaN(x) && !isNaN(y)) {
        const point = { x, y };
        const sizeAttr = ptEl.getAttribute("size");
        if (sizeAttr && !isNaN(parseFloat(sizeAttr))) {
            point.size = parseFloat(sizeAttr);
        }
        const colorAttr = ptEl.getAttribute("color");
        if (colorAttr) {
            point.color = colorAttr;
        }
        plot.data.points.push(point);
    }
}

function parseSubcomponentData(plot) {
    // Disable connectedCallback on child web components
    for (const child of plot.children) {
        if (child.tagName.toLowerCase().startsWith("delta-")) {
            child.connectedCallback = () => {};
        }
    }
    plot.elements = [];

    // Title
    let titleEl = plot.querySelector("delta-title");
    if (titleEl) {
        plot.elements.push(titleEl);
    }

    // Grid
    let gridEl = plot.querySelector("delta-grid");
    if ((plot.type === "cartesian" || plot.type === "points") && !gridEl) {
        gridEl = document.createElement("delta-grid");
    }
    if (gridEl) plot.elements.push(gridEl);

    // Axis
    let axisEl = plot.querySelector("delta-axis");
    if ((plot.type === "cartesian" || plot.type === "points") && !axisEl) {
        axisEl = document.createElement("delta-axis");
    }
    if (axisEl) plot.elements.push(axisEl);

    // Singular Points
    let singularPoints = plot.querySelectorAll("delta-point");
    for (const pt of singularPoints) {
        parsePointToData(plot, pt);
    }

    // Points Subcomponent
    let pointsEl = plot.querySelector("delta-points");
    if ((plot.type === "points" || plot.data.points.length > 0) && !pointsEl) {
        pointsEl = document.createElement("delta-points");
    }
    if (pointsEl) plot.elements.push(pointsEl);

    plot.innerHTML = "";
}