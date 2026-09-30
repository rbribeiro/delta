// Axis Subcomponent Actions
function parseAxisOptions(axisEl) {
    const rawShow = axisEl.getAttribute("show") || "true";
    const show = parseOption(rawShow, ["true", "false", "x", "y"]);
    const color = axisEl.getAttribute("color") || DEFAULT_AXIS_LABEL_COLOR;

    return { show, color };
}

function drawXAxisNumbers(ctx, w, h, plot, color) {
    const { centerX, scale } = getPlotCenter(plot, w, h);
    const roundCenterX = Math.round(centerX);

    ctx.font = DEFAULT_AXIS_LABEL_FONT;
    ctx.fillStyle = color;

    const stepUnitX = getNiceStep(TARGET_GRID_SPACING / scale);
    const stepPxX = stepUnitX * scale;
    const textY = h - 6;

    const minUnit = Math.floor((-roundCenterX) / stepPxX) * stepUnitX;
    const maxUnit = Math.ceil((w - roundCenterX) / stepPxX) * stepUnitX;

    for (let u = minUnit; u <= maxUnit + stepUnitX * 0.5; u += stepUnitX) {
        const val = parseFloat(u.toFixed(8)) + 0;
        const sx = Math.round(roundCenterX + u * scale);
        if (sx >= 0 && sx <= w) {
            ctx.textBaseline = "bottom";
            if (sx < 25) {
                ctx.textAlign = "left";
                ctx.fillText(formatNumber(val), Math.max(4, sx), textY);
            } else if (sx > w - 25) {
                ctx.textAlign = "right";
                ctx.fillText(formatNumber(val), Math.min(w - 4, sx), textY);
            } else {
                ctx.textAlign = "center";
                ctx.fillText(formatNumber(val), sx, textY);
            }
        }
    }
}

function drawYAxisNumbers(ctx, w, h, plot, color) {
    const { centerY, scale } = getPlotCenter(plot, w, h);
    const roundCenterY = Math.round(centerY);

    ctx.font = DEFAULT_AXIS_LABEL_FONT;
    ctx.fillStyle = color;

    const stepUnitY = getNiceStep(TARGET_GRID_SPACING / scale);
    const stepPxY = stepUnitY * scale;
    const textX = 8;

    const minUnit = Math.floor((roundCenterY - h) / stepPxY) * stepUnitY;
    const maxUnit = Math.ceil(roundCenterY / stepPxY) * stepUnitY;

    for (let u = minUnit; u <= maxUnit + stepUnitY * 0.5; u += stepUnitY) {
        const val = parseFloat(u.toFixed(8)) + 0;
        const sy = Math.round(roundCenterY - u * scale);
        if (sy >= 0 && sy <= h) {
            ctx.textAlign = "left";
            if (sy < 16) {
                ctx.textBaseline = "top";
                ctx.fillText(formatNumber(val), textX, 4);
            } else if (sy > h - 22) {
                ctx.textBaseline = "bottom";
                ctx.fillText(formatNumber(val), textX, h - 18);
            } else {
                ctx.textBaseline = "middle";
                ctx.fillText(formatNumber(val), textX, sy);
            }
        }
    }
}
