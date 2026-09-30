// Point Subcomponent Actions
function parsePointAttributes(pointEl) {
    let x = parseFloat(pointEl.getAttribute("x")) || 0;
    let y = parseFloat(pointEl.getAttribute("y")) || 0;

    const tuple = parseTuple(pointEl.getAttribute("pos"), 2, true);
    if (tuple) {
        x = tuple[0];
        y = tuple[1];
    }

    const color = pointEl.getAttribute("color") || null;
    const rawSize = parseFloat(pointEl.getAttribute("size"));
    const size = isNaN(rawSize) ? null : rawSize;
    const name = pointEl.getAttribute("name") || "";

    return { x, y, color, size, name };
}

function registerPointInPlot(plot, pointData) {
    return addPoint(plot, pointData);
}
