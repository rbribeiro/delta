// Visual Constants
const BASE_SIZE_SCALE = 40;
const BASE_SCALE = BASE_SIZE_SCALE;
const TARGET_GRID_SPACING = 50;
const GRID_LINE_COLOR = "rgba(128, 128, 128, 0.12)";
const GRID_LINE_WIDTH = 1;
const AXIS_LINE_COLOR = "rgba(128, 128, 128, 0.24)";
const AXIS_LINE_WIDTH = 1;
const AXIS_LABEL_FONT = "10px sans-serif";
const AXIS_LABEL_COLOR = "rgba(40, 40, 40, 0.85)";

// Data and String Parsing
function parseTuple(tuple, k = 0, numbers = true) {
    if (tuple == null) return null;
    const parts = tuple.split(',');
    if (k > 0 && parts.length !== k) return null;
    
    if (numbers) {
        const nums = parts.map(el => parseFloat(el.trim()));
        if (nums.some(num => isNaN(num))) return null;
        return nums;
    } else {
        return parts;
    }
}

function parseOption(value, options) {
    const isArray = Array.isArray(options);
    const keys = isArray ? options : Object.keys(options);
    const firstValue = isArray ? options[0] : options[keys[0]];

    if (!value) return firstValue;
    const val = String(value).toLowerCase();

    for (let key of keys) {
        if (val === String(key).toLowerCase()) {
            return isArray ? key : options[key];
        }
    }

    return firstValue;
}

// Math and Formatting
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

// Coordinate Conversion Helpers
function getPlotCenter(plot, w, h) {
    const width = (w !== undefined) ? w : (plot.canvas ? plot.canvas.clientWidth : 0);
    const height = (h !== undefined) ? h : (plot.canvas ? plot.canvas.clientHeight : 0);
    return {
        centerX: width / 2 + plot.offsetX,
        centerY: height / 2 + plot.offsetY,
        scale: BASE_SIZE_SCALE * plot.zoom
    };
}

function worldToScreen(x, y, plot, w, h) {
    const { centerX, centerY, scale } = getPlotCenter(plot, w, h);
    return {
        sx: Math.round(centerX + x * scale),
        sy: Math.round(centerY - y * scale)
    };
}

function screenToWorld(sx, sy, plot, w, h) {
    const { centerX, centerY, scale } = getPlotCenter(plot, w, h);
    return {
        x: parseFloat(((sx - centerX) / scale).toFixed(6)),
        y: parseFloat(((centerY - sy) / scale).toFixed(6))
    };
}

// Reactive Authoritative Plot Data
function createPlotData(plot, initial = {}) {
    let nextId = 1;
    let notifyScheduled = false;

    const notify = () => {
        if (!plot) return;
        if (notifyScheduled) return;
        notifyScheduled = true;
        queueMicrotask(() => {
            notifyScheduled = false;
            if (plot.render) plot.render();
            plot.dispatchEvent(new CustomEvent("delta:data-change", { detail: plot.data }));
        });
    };

    function reactive(obj) {
        if (typeof obj !== "object" || obj === null) return obj;

        return new Proxy(obj, {
            get(target, prop, receiver) {
                const val = Reflect.get(target, prop, receiver);
                if (typeof val === "object" && val !== null) {
                    return reactive(val);
                }
                return val;
            },
            set(target, prop, val, receiver) {
                // Auto-assign unique id to point object if missing
                if (Array.isArray(target) && prop !== "length" && typeof val === "object" && val !== null) {
                    if (val.id === undefined) val.id = nextId++;
                }
                const oldVal = target[prop];
                const res = Reflect.set(target, prop, val, receiver);
                if (oldVal !== val || prop === "length") {
                    notify();
                }
                return res;
            },
            deleteProperty(target, prop) {
                const res = Reflect.deleteProperty(target, prop);
                notify();
                return res;
            }
        });
    }

    return reactive({
        points: [],
        ...initial
    });
}