// Axis Subcomponent Actions
function parseAxisOptions(axisEl) {
    const rawShow = axisEl.getAttribute("show") || "true";
    const show = parseOption(rawShow, ["true", "false", "x", "y"]);
    const color = axisEl.getAttribute("color") || null;

    return { show, color };
}

function drawXAxisNumbers(ctx, w, h, plot, color) {
    const { centerX, scale } = getPlotCenter(plot, w, h);
    const roundCenterX = Math.round(centerX);
    const styles = getPlotStyles(plot);

    ctx.font = styles.axisFont;
    ctx.fillStyle = color || styles.axisColor;

    const stepUnitX = getNiceStep(TARGET_GRID_SPACING / scale);
    const stepPxX = stepUnitX * scale;
    const textY = h - 6;

    const minUnit = Math.floor((-roundCenterX) / stepPxX) * stepUnitX;
    const maxUnit = Math.ceil((w - roundCenterX) / stepPxX) * stepUnitX;

    for (let u = minUnit; u <= maxUnit + stepUnitX * 0.5; u += stepUnitX) {
        const sx = Math.round(roundCenterX + u * scale);
        if (sx >= 0 && sx <= w) {
            ctx.textBaseline = "bottom";
            if (sx < 25) {
                ctx.textAlign = "left";
                ctx.fillText(formatNumber(u), Math.max(4, sx), textY);
            } else if (sx > w - 25) {
                ctx.textAlign = "right";
                ctx.fillText(formatNumber(u), Math.min(w - 4, sx), textY);
            } else {
                ctx.textAlign = "center";
                ctx.fillText(formatNumber(u), sx, textY);
            }
        }
    }
}

function drawYAxisNumbers(ctx, w, h, plot, color) {
    const { centerY, scale } = getPlotCenter(plot, w, h);
    const roundCenterY = Math.round(centerY);
    const styles = getPlotStyles(plot);

    ctx.font = styles.axisFont;
    ctx.fillStyle = color || styles.axisColor;

    const stepUnitY = getNiceStep(TARGET_GRID_SPACING / scale);
    const stepPxY = stepUnitY * scale;
    const textX = 8;

    const minUnit = Math.floor((roundCenterY - h) / stepPxY) * stepUnitY;
    const maxUnit = Math.ceil(roundCenterY / stepPxY) * stepUnitY;

    for (let u = minUnit; u <= maxUnit + stepUnitY * 0.5; u += stepUnitY) {
        const sy = Math.round(roundCenterY - u * scale);
        if (sy >= 0 && sy <= h) {
            ctx.textAlign = "left";
            if (sy < 16) {
                ctx.textBaseline = "top";
                ctx.fillText(formatNumber(u), textX, 4);
            } else if (sy > h - 22) {
                ctx.textBaseline = "bottom";
                ctx.fillText(formatNumber(u), textX, h - 18);
            } else {
                ctx.textBaseline = "middle";
                ctx.fillText(formatNumber(u), textX, sy);
            }
        }
    }
}
