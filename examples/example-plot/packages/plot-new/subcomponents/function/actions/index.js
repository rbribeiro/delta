// Function Subcomponent Actions
function parseFunctionOptions(fnEl) {
    const rawExpr = fnEl.textContent.trim();
    const vars = ["x", "y"];
    const f = make_function(rawExpr, vars);

    const color = fnEl.getAttribute("color") || null;
    const from = parseTuple(fnEl.getAttribute("from"), 2, true);
    const to = parseTuple(fnEl.getAttribute("to"), 2, true);
    const name = fnEl.getAttribute("name") || "";

    return { rawExpr, vars, f, color, from, to, name };
}

function drawFunctionCurves(ctx, w, h, plot, precision = 1000) {
    const funcs = plot.data?.functions || [];
    if (!funcs.length) return;

    const { centerX, centerY, scale } = getPlotCenter(plot, w, h);
    if (scale <= 0) return;

    
    const defaultAccent = getPlotStyles(plot).accent;
    const xMin = -centerX / scale;
    const xMax = (w - centerX) / scale;

    for (const fnObj of funcs) {
        if (!fnObj || typeof fnObj.f !== "function") continue;

        // Apply domain [a, b] restriction if specified
        let startX = xMin;
        let endX = xMax;
        if (fnObj.from && fnObj.from.length === 2) {
            startX = Math.max(xMin, fnObj.from[0]);
            endX = Math.min(xMax, fnObj.from[1]);
        }
        if (startX >= endX) continue;

        // Dynamic sampling density: at least 2 samples per screen pixel to eliminate jagged segments
        const screenSpan = Math.max(1, (endX - startX) * scale);
        const sampleCount = Math.max(precision, Math.ceil(screenSpan * 2));
        const step = (endX - startX) / (sampleCount - 1);

        ctx.save();
        ctx.strokeStyle = fnObj.color || defaultAccent;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        let penDown = false;
        let prevSy = null;

        for (let i = 0; i < sampleCount; i++) {
            const xi = startX + i * step;
            let yi;
            try {
                yi = fnObj.f(xi, 0);
            } catch (_) {
                yi = null;
            }

            let isValid = (yi !== null && typeof yi === "number" && !isNaN(yi) && isFinite(yi));

            // Apply codomain [u, v] restriction if specified
            if (isValid && fnObj.to && fnObj.to.length === 2) {
                if (yi < fnObj.to[0] || yi > fnObj.to[1]) {
                    isValid = false;
                }
            }

            if (isValid) {
                // Exact floating-point coordinates enable native subpixel anti-aliasing
                const sx = centerX + xi * scale;
                const sy = centerY - yi * scale;

                // Detect extreme asymptote jumps (e.g. 1/x crossing x=0)
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
}
