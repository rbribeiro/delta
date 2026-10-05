// Title Subcomponent Actions
function parseTitleOptions(titleEl) {
    return {
        text: titleEl.textContent.trim(),
        color: titleEl.getAttribute("color") || null
    };
}

function buildTitleHeader(plot, { text, color }) {
    plot.title = text;

    const textEl = document.createElement("span");
    textEl.className = "plot-title";
    textEl.textContent = text;

    if (color) {
        textEl.style.color = color;
    }

    plot.header.append(textEl);
}
