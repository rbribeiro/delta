/** The small header that names the pack, in the document's language (`window.Delta.t`). */
export function label(): HTMLElement {
  const el = document.createElement("span");
  el.className = "pack-example-label";
  el.textContent = window.Delta.t("example.label", "Example pack");
  return el;
}
