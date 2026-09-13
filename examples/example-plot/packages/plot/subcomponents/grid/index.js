class DeltaGrid extends HTMLElement {
    build(plot) {
        this.showAttr = this.getAttribute("show") || "true";
        this.show = parseOption(this.showAttr, ["true", "false", "origin", "basic"]);
    }

    bind(plot) {}

    render(ctx, w, h, plot) {
        if (this.show === "false") return;

        const { centerX, centerY, scale } = getPlotCenter(plot, w, h);
        const roundCenterX = Math.round(centerX);
        const roundCenterY = Math.round(centerY);

        // Grid lines
        if (this.show === "true" || this.show === "basic") {
            ctx.strokeStyle = GRID_LINE_COLOR;
            ctx.lineWidth = GRID_LINE_WIDTH;

            const stepUnit = getNiceStep(TARGET_GRID_SPACING / scale);
            const stepPx = stepUnit * scale;

            // Vertical lines (X direction)
            const startX = ((roundCenterX % stepPx) + stepPx) % stepPx;
            for (let x = startX; x <= w + 0.5; x += stepPx) {
                const rx = Math.round(x);
                ctx.beginPath();
                ctx.moveTo(rx + 0.5, 0);
                ctx.lineTo(rx + 0.5, h);
                ctx.stroke();
            }

            // Horizontal lines (Y direction)
            const startY = ((roundCenterY % stepPx) + stepPx) % stepPx;
            for (let y = startY; y <= h + 0.5; y += stepPx) {
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
            if (roundCenterY >= 0 && roundCenterY <= h) {
                ctx.beginPath();
                ctx.moveTo(0, roundCenterY + 0.5);
                ctx.lineTo(w, roundCenterY + 0.5);
                ctx.stroke();
            }

            // Y axis
            if (roundCenterX >= 0 && roundCenterX <= w) {
                ctx.beginPath();
                ctx.moveTo(roundCenterX + 0.5, 0);
                ctx.lineTo(roundCenterX + 0.5, h);
                ctx.stroke();
            }
        }
    }
}

customElements.define("delta-grid", DeltaGrid);
