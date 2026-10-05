// Point Subcomponent
class DeltaPoint extends HTMLElement {
    build(plot) {
        const pointData = parsePointAttributes(this);
        addPoint(plot, pointData);
    }

    bind(plot) {}

    render(ctx, w, h, plot) {}
}

customElements.define("delta-point", DeltaPoint);
