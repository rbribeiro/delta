import { kindOf } from "./dom.ts";

/**
 * Formats a `<delta-paper>` into an inline reference fragment ("Author. Title.
 * Journal. Year." + an optional link), cloning each field's children so the
 * source node is left intact. Shared by the bibliography list and the citation
 * hovercard. Math/emphasis inside a field survive (childNodes are cloned, not
 * flattened to text).
 */
export function formatPaper(paper: Element): DocumentFragment {
  const frag = document.createDocumentFragment();
  const field = (name: string): Element | null => paper.querySelector(`:scope > delta-${name}`);

  const present = ["author", "title", "journal", "year"]
    .map(field)
    .filter((el): el is Element => el !== null);

  present.forEach((el, i) => {
    if (i > 0) frag.append(". ");
    const span = document.createElement("span");
    span.className = `paper-${kindOf(el)}`;
    for (const node of el.childNodes) span.append(node.cloneNode(true));
    frag.append(span);
  });
  if (present.length) frag.append(".");

  // A trailing <link>/<url> rides through as a real link (DeltaLink upgrades it).
  const link = field("link") ?? field("url");
  if (link) {
    frag.append(" ");
    frag.append(link.cloneNode(true));
  }
  return frag;
}
