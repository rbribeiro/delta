// Grid Subcomponent Actions
function parseGridOptions(gridEl) {
    const rawShow = gridEl.getAttribute("show") || "true";
    const show = parseOption(rawShow, ["true", "false", "origin", "basic"]);
    const color = gridEl.getAttribute("color") || null;
    const thickness = parseFloat(gridEl.getAttribute("thickness") || gridEl.getAttribute("width")) || 1;

    return { show, color, thickness };
}

function drawGridMesh(ctx, w, h, plot, color, thickness) {
    const { centerX, centerY, scale } = getPlotCenter(plot, w, h);
    const roundCenterX = Math.round(centerX);
    const roundCenterY = Math.round(centerY);

    ctx.strokeStyle = color || getPlotStyles(plot).gridColor;
    ctx.lineWidth = thickness;

    const stepUnit = getNiceStep(TARGET_GRID_SPACING / scale);
    const stepPx = stepUnit * scale;

    // Vertical grid lines
    const startX = ((roundCenterX % stepPx) + stepPx) % stepPx;
    for (let x = startX; x <= w + 0.5; x += stepPx) {
        const rx = Math.round(x);
        ctx.beginPath();
        ctx.moveTo(rx + 0.5, 0);
        ctx.lineTo(rx + 0.5, h);
        ctx.stroke();
    }

    // Horizontal grid lines
    const startY = ((roundCenterY % stepPx) + stepPx) % stepPx;
    for (let y = startY; y <= h + 0.5; y += stepPx) {
        const ry = Math.round(y);
        ctx.beginPath();
        ctx.moveTo(0, ry + 0.5);
        ctx.lineTo(w, ry + 0.5);
        ctx.stroke();
    }
}

function drawOriginCross(ctx, w, h, plot, color, thickness) {
    const { centerX, centerY } = getPlotCenter(plot, w, h);
    const roundCenterX = Math.round(centerX);
    const roundCenterY = Math.round(centerY);

    // If color was custom-defined on tag, use it; otherwise use theme origin color
    const originColor = color || getPlotStyles(plot).originColor;
    ctx.strokeStyle = originColor;
    ctx.lineWidth = Math.max(1, thickness);

    // X origin axis
    if (roundCenterY >= 0 && roundCenterY <= h) {
        ctx.beginPath();
        ctx.moveTo(0, roundCenterY + 0.5);
        ctx.lineTo(w, roundCenterY + 0.5);
        ctx.stroke();
    }

    // Y origin axis
    if (roundCenterX >= 0 && roundCenterX <= w) {
        ctx.beginPath();
        ctx.moveTo(roundCenterX + 0.5, 0);
        ctx.lineTo(roundCenterX + 0.5, h);
        ctx.stroke();
    }
}
