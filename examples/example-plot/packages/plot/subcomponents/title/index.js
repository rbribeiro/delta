class DeltaTitle extends HTMLElement {
    build(plot) {
        plot.title = this.innerHTML;
    }

    bind(plot) {}

    render(ctx, w, h, plot) {}
}

customElements.define("delta-title", DeltaTitle);
