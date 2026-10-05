// Axis Subcomponent
class DeltaAxis extends HTMLElement {
    build(plot) {
        this.options = parseAxisOptions(this);
    }

    bind(plot) {}

    render(ctx, w, h, plot) {
        const { show, color } = this.options;
        if (show === "false") return;

        const showX = (show === "true" || show === "x");
        const showY = (show === "true" || show === "y");

        if (showX) {
            drawXAxisNumbers(ctx, w, h, plot, color);
        }

        if (showY) {
            drawYAxisNumbers(ctx, w, h, plot, color);
        }
    }
}

customElements.define("delta-axis", DeltaAxis);
