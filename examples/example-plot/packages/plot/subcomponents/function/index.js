function drawFunction(plot, ctx, w, h, f, precision = 1000, color = null) {
    if (typeof f !== "function") return;
    if (!ctx || w === 0 || h === 0) return;

    const { centerX, centerY, scale } = getPlotCenter(plot, w, h);
    if (scale <= 0) return;

    const xMin = -centerX / scale;
    const xMax = (w - centerX) / scale;
    const screenSpan = Math.max(1, (xMax - xMin) * scale);
    const sampleCount = Math.max(precision, Math.ceil(screenSpan * 2));
    const step = (xMax - xMin) / (sampleCount - 1);

    ctx.save();
    ctx.strokeStyle = color || getComputedStyle(plot).getPropertyValue("--delta-accent").trim() || "rgb(80, 80, 80)";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    let penDown = false;
    let prevSy = null;

    for (let i = 0; i < sampleCount; i++) {
        const xi = xMin + i * step;
        let yi;
        try {
            yi = f(xi, 0);
        } catch (e) {
            yi = null;
        }

        const isValid = (yi !== null && typeof yi === "number" && !isNaN(yi) && isFinite(yi));

        if (isValid) {
            const sx = centerX + xi * scale;
            const sy = centerY - yi * scale;

            const isAsymptoteJump = (prevSy !== null && Math.abs(sy - prevSy) > h * 3);

            if (!penDown || isAsymptoteJump) {
                ctx.moveTo(sx, sy);
                penDown = true;
            } else {
                ctx.lineTo(sx, sy);
            }
            prevSy = sy;
        } else {
            penDown = false;
            prevSy = null;
        }
    }

    ctx.stroke();
    ctx.restore();
}

class DeltaFunction extends HTMLElement {
    build(plot) {
        this.plot = plot;
        if (!plot.data) plot.data = {};
        if (!plot.data.functions) plot.data.functions = [];

        const rawExpr = this.textContent.trim();
        const vars = ['x', 'y'];
        const f = make_function(rawExpr, vars);
        const color = this.getAttribute("color") || null;

        this.fnData = { f, vars, rawExpr, color };
        plot.data.functions.push(this.fnData);
    }

    bind(plot) {
        this.plot = plot;
    }

    render(ctx, w, h, plot) {
        const isFirst = (plot.elements.find(el => el.tagName === "DELTA-FUNCTION") === this);
        if (!isFirst) return;

        const funcs = plot.data?.functions || [];
        for (const fnObj of funcs) {
            if (fnObj && fnObj.f) {
                drawFunction(plot, ctx, w, h, fnObj.f, 1000, fnObj.color);
            }
        }
    }
}

customElements.define("delta-function", DeltaFunction);