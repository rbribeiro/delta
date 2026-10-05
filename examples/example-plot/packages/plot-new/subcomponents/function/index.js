// Function Subcomponent
class DeltaFunction extends HTMLElement {
    build(plot) {
        const fnData = parseFunctionOptions(this);
        addFunction(plot, fnData);
    }

    bind(plot) {}

    render(ctx, w, h, plot) {
        // Render all registered functions once per plot frame from the first function element
        const isFirst = (plot.elements.find(el => el.tagName === "DELTA-FUNCTION") === this);
        if (isFirst) {
            drawFunctionCurves(ctx, w, h, plot);
        }
    }
}

customElements.define("delta-function", DeltaFunction);
