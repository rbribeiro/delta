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

function drawFunctionCurves(ctx, w, h, plot, samplesPerGrid = 100) {
    const funcs = plot.data?.functions || [];
    if (!funcs.length) return;

    const { centerX, centerY, scaleX, scaleY } = getPlotCenter(plot, w, h);
    if (scaleX <= 0 || scaleY <= 0) return;

    const defaultAccent = getPlotStyles(plot).accent;
    const xMin = -centerX / scaleX;
    const xMax = (w - centerX) / scaleX;

    const stepUnitX = getNiceStep(TARGET_GRID_SPACING / scaleX);
    const dx = stepUnitX / Math.max(10, samplesPerGrid);
    if (dx <= 0) return;

    const EPS = 1e-9;

    for (const fnObj of funcs) {
        if (!fnObj || typeof fnObj.f !== "function") continue;

        // Viewport bounds with guard margin
        let startX = xMin - dx;
        let endX = xMax + dx;
        const hasFrom = Boolean(fnObj.from && fnObj.from.length === 2);
        if (hasFrom) {
            startX = Math.max(startX, fnObj.from[0]);
            endX = Math.min(endX, fnObj.from[1]);
        }
        if (startX >= endX) continue;

        ctx.save();
        ctx.strokeStyle = fnObj.color || defaultAccent;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        let penDown = false;
        let prevSy = null;

        const evalPoint = (xi) => {
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
                const sx = centerX + xi * scaleX;
                const sy = centerY - yi * scaleY;

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
        };

        // Grid-aligned sampling loop
        if (hasFrom && fnObj.from[0] >= startX) {
            evalPoint(fnObj.from[0]);
        }

        const iStart = Math.ceil(startX / dx);
        const iEnd = Math.floor(endX / dx);
        for (let i = iStart; i <= iEnd; i++) {
            const xi = i * dx;
            if (hasFrom && (xi <= fnObj.from[0] + EPS || xi >= fnObj.from[1] - EPS)) continue;
            evalPoint(xi);
        }

        if (hasFrom && fnObj.from[1] <= endX) {
            evalPoint(fnObj.from[1]);
        }

        ctx.stroke();
        ctx.restore();
    }
}
