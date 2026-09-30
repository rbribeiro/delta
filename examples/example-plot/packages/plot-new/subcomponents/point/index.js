// Point Subcomponent
class DeltaPoint extends HTMLElement {
    build(plot) {
        const pointData = parsePointAttributes(this);
        registerPointInPlot(plot, pointData);
    }

    bind(plot) {}

    render(ctx, w, h, plot) {}
}

customElements.define("delta-point", DeltaPoint);
