// Points Controller Subcomponent
class DeltaPoints extends HTMLElement {
    build(plot) {
        this.options = parsePointsOptions(this);
        this.state = createPointsState();

        this.badge = createFloatingBadge(this, plot);
        this.footer = createPointsFooter(this, plot);

        plot.container.append(this.badge, this.footer);
    }

    bind(plot) {
        bindPointsInteractions(this, plot);
    }

    render(ctx, w, h, plot) {
        updatePointsUI(this, plot);
        drawPointsLayer(ctx, w, h, plot, this);
    }

    isDraggingEntity() {
        return this.state.mode && this.options.interaction !== "false";
    }
}

customElements.define("delta-points", DeltaPoints);
