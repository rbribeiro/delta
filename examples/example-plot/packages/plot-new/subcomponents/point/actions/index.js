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
    const size = parseFloat(pointEl.getAttribute("size")) || null;
    const name = pointEl.getAttribute("name") || "";

    return { x, y, color, size, name };
}
