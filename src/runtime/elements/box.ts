/**
 * <box> — a generic callout / admonition block (note, tip, warning, alert). A
 * tinted block with a strong colored left border and an optional `<title>` heading.
 *
 *   <box color="blue"><title>Note</title>…</box>   named palette hue
 *   <box color="#5b3fb0">…</box>                    any hex / CSS color
 *   <box type="warning">…</box>                     semantic preset → a palette hue
 *   <box>…</box>                                     the document's accent
 *
 * The hue is a single seed on `--delta-accent`, set here from `color` (or a `type`
 * preset; `color` wins). A recognized palette name goes through `data-accent` (reusing
 * the bare `[data-accent="…"]` token blocks in base.css); anything else (hex, rgb(),
 * a CSS keyword) is set inline. components/box.css derives border/background/text
 * from that one seed via color-mix, so nothing is hardcoded and it tracks light/dark.
 */

// The named palettes defined in base.css ([data-accent="…"]); anything else is
// treated as a literal CSS color set inline on --delta-accent.
const PALETTES = new Set([
  "red", "orange", "yellow", "lime", "green", "teal",
  "sky", "blue", "indigo", "purple", "pink", "slate",
]);

// Semantic presets → a palette hue. `color` overrides this.
const TYPE_COLOR: Record<string, string> = {
  danger: "red",
  warning: "orange",
  tip: "green",
  note: "blue",
};

class DeltaBox extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const color =
      this.getAttribute("color")?.trim() ||
      TYPE_COLOR[this.getAttribute("type")?.trim().toLowerCase() ?? ""];
    if (color) {
      if (PALETTES.has(color.toLowerCase())) this.setAttribute("data-accent", color.toLowerCase());
      else this.style.setProperty("--delta-accent", color); // hex / rgb() / CSS keyword
    }

    // Lift the author's <title> into a heading; the rest becomes the body.
    const title = this.querySelector(":scope > delta-title");
    let heading: HTMLElement | null = null;
    if (title) {
      heading = document.createElement("div");
      heading.className = "box-heading";
      heading.append(...title.childNodes); // move children so math/emphasis survive
      title.remove();
    }
    const body = document.createElement("div");
    body.className = "box-body";
    body.append(...this.childNodes);
    if (heading) this.append(heading);
    this.append(body);
  }
}

export function defineBox(): void {
  customElements.define("delta-box", DeltaBox);
}
