// Visual and Layout Constants
const BASE_SIZE_SCALE = 40;
const TARGET_GRID_SPACING = 50;

function getPlotStyles(plot) {
    if (!plot) {
        return {
            gridColor: "rgba(128, 128, 128, 0.12)",
            originColor: "rgba(128, 128, 128, 0.24)",
            axisColor: "rgba(40, 40, 40, 0.85)",
            axisFont: "10px sans-serif",
            accent: "#4f46e5"
        };
    }
    const s = getComputedStyle(plot);
    return {
        gridColor: s.getPropertyValue("--plot-grid-color").trim() || "rgba(128, 128, 128, 0.12)",
        originColor: s.getPropertyValue("--plot-origin-color").trim() || "rgba(128, 128, 128, 0.24)",
        axisColor: s.getPropertyValue("--plot-axis-color").trim() || "rgba(40, 40, 40, 0.85)",
        axisFont: s.getPropertyValue("--plot-axis-font").trim() || "10px sans-serif",
        accent: s.getPropertyValue("--plot-accent").trim() || s.getPropertyValue("--delta-accent").trim() || "#4f46e5"
    };
}

// String and Tuple Parsing
function parseTuple(tupleStr, k = 0, numbers = true) {
    if (tupleStr == null) return null;
    const parts = String(tupleStr).split(",");
    if (k > 0 && parts.length !== k) return null;

    if (numbers) {
        const nums = parts.map(el => parseFloat(el.trim()));
        if (nums.some(num => isNaN(num))) return null;
        return nums;
    }
    return parts.map(el => el.trim());
}

function parseOption(value, options) {
    const isArray = Array.isArray(options);
    const keys = isArray ? options : Object.keys(options);
    const defaultValue = isArray ? options[0] : options[keys[0]];

    if (!value) return defaultValue;
    const normalized = String(value).toLowerCase().trim();

    for (const key of keys) {
        if (normalized === String(key).toLowerCase()) {
            return isArray ? key : options[key];
        }
    }
    return defaultValue;
}

// Coordinate and Formatting Helpers
function getPlotCenter(plot, w, h) {
    const width = (w !== undefined) ? w : (plot.canvas ? plot.canvas.clientWidth : 0);
    const height = (h !== undefined) ? h : (plot.canvas ? plot.canvas.clientHeight : 0);
    const baseScale = BASE_SIZE_SCALE * plot.zoom;
    const sx = plot.stretchX || 1;
    const sy = plot.stretchY || 1;
    return {
        centerX: width / 2 + plot.offsetX,
        centerY: height / 2 + plot.offsetY,
        scale: baseScale,
        scaleX: baseScale * sx,
        scaleY: baseScale * sy
    };
}

function worldToScreen(x, y, plot, w, h) {
    const { centerX, centerY, scaleX, scaleY } = getPlotCenter(plot, w, h);
    return {
        sx: centerX + x * scaleX,
        sy: centerY - y * scaleY
    };
}

function screenToWorld(sx, sy, plot, w, h) {
    const { centerX, centerY, scaleX, scaleY } = getPlotCenter(plot, w, h);
    return {
        x: parseFloat(((sx - centerX) / scaleX).toFixed(6)),
        y: parseFloat(((centerY - sy) / scaleY).toFixed(6))
    };
}

function getNiceStep(targetStep) {
    const pow10 = Math.pow(10, Math.floor(Math.log10(targetStep)));
    const frac = targetStep / pow10;
    if (frac >= 7.5) return 10 * pow10;
    if (frac >= 3.5) return 5 * pow10;
    if (frac >= 1.5) return 2 * pow10;
    return pow10;
}

function formatNumber(val, precision = 6) {
    if (Math.abs(val) < 1e-10) return "0";
    return parseFloat(val.toFixed(precision)).toString();
}
