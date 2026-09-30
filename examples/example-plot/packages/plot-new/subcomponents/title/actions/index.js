// Title Subcomponent Actions
function parseTitleOptions(titleEl) {
    return {
        text: titleEl.textContent.trim(),
        color: titleEl.getAttribute("color") || null
    };
}

function buildTitleHeader(plot, { text, color }) {
    plot.title = text;

    const headerEl = document.createElement("div");
    headerEl.className = "plot-header";

    const textEl = document.createElement("span");
    textEl.className = "plot-title";
    textEl.textContent = text;

    if (color) {
        textEl.style.color = color;
    }

    headerEl.append(textEl);
    plot.container.prepend(headerEl);
    return headerEl;
}
