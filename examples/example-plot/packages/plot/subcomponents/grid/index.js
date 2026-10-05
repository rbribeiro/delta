// Grid Subcomponent
class DeltaGrid extends HTMLElement {
    build(plot) {
        this.options = parseGridOptions(this);
    }

    bind(plot) {}

    render(ctx, w, h, plot) {
        const { show, color, thickness } = this.options;
        if (show === "false") return;

        if (show === "true" || show === "basic") {
            drawGridMesh(ctx, w, h, plot, color, thickness);
        }

        if (show === "true" || show === "origin") {
            drawOriginCross(ctx, w, h, plot, color, thickness);
        }
    }
}

customElements.define("delta-grid", DeltaGrid);
