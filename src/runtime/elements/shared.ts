/**
 * Cross-element runtime helpers shared by more than one component. Keep
 * single-component helpers next to their element.
 */

/**
 * Smooth-scrolls to `#id` and flashes it (the shared `.is-xref-target` animation).
 * Used by `<cite>` jump-to links; `<ref>`/`<toc>` inline their own copies.
 */
export function flashTarget(id: string): void {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView({ block: "center", behavior: "smooth" });
  target.classList.add("is-xref-target");
  target.addEventListener("animationend", () => target.classList.remove("is-xref-target"), {
    once: true,
  });
}

/**
 * Formats a `<delta-paper>` into an inline reference fragment ("Author. Title.
 * Journal. Year." + an optional link), cloning each field's children so the
 * source node is left intact. Shared by the bibliography list and the citation
 * hovercard. Math/emphasis inside a field survive (childNodes are cloned, not
 * flattened to text).
 */
export function formatPaper(paper: Element): DocumentFragment {
  const frag = document.createDocumentFragment();
  const field = (name: string): Element | null =>
    paper.querySelector(`:scope > delta-${name}`);

  const present = ["author", "title", "journal", "year"]
    .map(field)
    .filter((el): el is Element => el !== null);

  present.forEach((el, i) => {
    if (i > 0) frag.append(". ");
    const span = document.createElement("span");
    span.className = `paper-${el.tagName.toLowerCase().replace("delta-", "")}`;
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

/**
 * Makes `host` collapsible when it carries `collapsible="true"` (or
 * `collapsed="true"`). The `label` (a heading, box tag, or proof lead) becomes the
 * disclosure toggle; the label's following siblings — the body, loose text and all
 * — move into a `.collapse-body` so they hide as one. Clicking or pressing
 * Enter/Space folds the host (`.is-collapsed`); the caret + hide live in collapse.css.
 */
export function applyCollapsible(host: HTMLElement, label: HTMLElement): void {
  const collapsed = host.getAttribute("collapsed") === "true";
  if (!collapsed && host.getAttribute("collapsible") !== "true") return;

  const body = document.createElement("div");
  body.className = "collapse-body";
  while (label.nextSibling) body.append(label.nextSibling);
  host.append(body);

  label.classList.add("collapse-toggle");
  label.setAttribute("role", "button");
  label.tabIndex = 0;

  const apply = (c: boolean): void => {
    host.classList.toggle("is-collapsed", c);
    label.setAttribute("aria-expanded", String(!c));
  };
  apply(collapsed);

  const flip = (): void => apply(!host.classList.contains("is-collapsed"));
  label.addEventListener("click", flip);
  label.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      flip();
    }
  });
}
