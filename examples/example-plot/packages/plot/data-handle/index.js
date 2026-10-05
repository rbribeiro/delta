// Authoritative Reactive Plot Data
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
                // Auto-assign unique id to entity objects inside collections
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
        functions: [],
        ...initial
    });
}

// Authoritative Point Actions
function addPoint(plot, point) {
    if (!plot.data) plot.data = createPlotData(plot);
    const item = {
        name: "",
        ...point
    };
    plot.data.points.push(item);
    return item;
}

function removePoint(plot, id) {
    if (!plot.data?.points) return;
    const index = plot.data.points.findIndex(p => p && p.id === id);
    if (index !== -1) {
        plot.data.points.splice(index, 1);
    }
}

function clearPoints(plot) {
    if (plot.data?.points) {
        plot.data.points.length = 0;
    }
}

// Authoritative Function Actions
function addFunction(plot, fnData) {
    if (!plot.data) plot.data = createPlotData(plot);
    const item = {
        name: "",
        ...fnData
    };
    plot.data.functions.push(item);
    return item;
}

function removeFunction(plot, id) {
    if (!plot.data?.functions) return;
    const index = plot.data.functions.findIndex(f => f && f.id === id);
    if (index !== -1) {
        plot.data.functions.splice(index, 1);
    }
}
