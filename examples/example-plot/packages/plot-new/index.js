// Plot Core Component
class DeltaPlot extends HTMLElement {
    connectedCallback() {
        if (this.dataset.deltaReady) return;
        this.dataset.deltaReady = "1";
        this.build();
    }

    build() {
        initPlotAttributes(this);
        createPlotStructure(this);
        collectPlotSubcomponents(this);

        for (const el of this.elements) {
            el.build(this);
        }

        this.bind();
        this.render();
    }

    bind() {
        new ResizeObserver(() => {
            this.render();
        }).observe(this.canvas);

        for (const el of this.elements) {
            el.bind(this);
        }

        bindPlotPan(this);
        bindPlotZoom(this);
    }

    render() {
        renderPlot(this);
    }
}

customElements.define("delta-plot", DeltaPlot);
