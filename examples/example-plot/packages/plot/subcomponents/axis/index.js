class DeltaAxis extends HTMLElement {
    build(plot) {
        this.showAttr = this.getAttribute("show") || "true";
        this.show = parseOption(this.showAttr, ["true", "false", "x", "y"]);
    }

    bind(plot) {}

    render(ctx, w, h, plot) {
        if (this.show === "false") return;
        const showX = (this.show === "true" || this.show === "x");
        const showY = (this.show === "true" || this.show === "y");

        const { centerX, centerY, scale } = getPlotCenter(plot, w, h);
        const roundCenterX = Math.round(centerX);
        const roundCenterY = Math.round(centerY);

        ctx.font = AXIS_LABEL_FONT;
        ctx.fillStyle = AXIS_LABEL_COLOR;

        // X-axis markings
        if (showX) {
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

        // Y-axis markings
        if (showY) {
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
    }
}

customElements.define("delta-axis", DeltaAxis);
