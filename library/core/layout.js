class Columns extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    const widths = [];
    const columnList = this.querySelectorAll("column");
    const totalColumns = columnList.length;
    // Getting the widths
    columnList.forEach((column) => {
      if (column.parentElement === this) {
        widths.push(parseInt(column.getAttribute("width") || 0));
      }
    });
    // Computing the width of unspecified columns
    const totalWidth = widths.reduce((acc, cv) => acc + cv, 0);
    const diff = 100 - totalWidth;
    const nonWidths = widths.reduce((acc, cv) => (acc += cv == 0 ? 1 : 0), 0);
    if (nonWidths > 0) {
      widths.forEach((w, i) => {
        widths[i] = w == 0 ? diff / nonWidths : w;
      });
    }
    const gridTemplate = widths.join("% ") + "%";
    this.style.display = "grid";
    this.style["grid-template-columns"] = gridTemplate;
    this.style["gap"] = "var(--columns-gap)";
  }
}
