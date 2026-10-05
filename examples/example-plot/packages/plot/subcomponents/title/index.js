// Title Subcomponent
class DeltaTitle extends HTMLElement {
    build(plot) {
        const opts = parseTitleOptions(this);
        buildTitleHeader(plot, opts);
    }

    bind(plot) {}

    render(ctx, w, h, plot) {}
}

customElements.define("delta-title", DeltaTitle);
