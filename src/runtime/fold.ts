/**
 * Folding: a host made collapsible by `collapsible`/`collapsed`, its toggle kept in step, and
 * the ancestors a jump has to open. The caret and the hiding live in collapse.css.
 */

/**
 * Folds or unfolds a host `applyCollapsible` wired, keeping its toggle's `aria-expanded` in
 * step. For controls that fold many hosts at once (the proof's step levels).
 */
export function setFolded(host: Element, folded: boolean): void {
  host.classList.toggle("is-collapsed", folded);
  host.querySelector(":scope > .collapse-toggle")?.setAttribute("aria-expanded", String(!folded));
}

/** Unfolds every folded ancestor of `el`, so a jump to a step inside a folded proof lands on it. */
export function unfoldAncestors(el: Element): void {
  for (
    let at = el.parentElement?.closest(".is-collapsed");
    at;
    at = at.parentElement?.closest(".is-collapsed")
  ) {
    setFolded(at, false);
  }
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
  // Beside the label: in the host itself, or (a box's header) in the sheet it heads.
  (label.parentElement ?? host).append(body);

  label.classList.add("collapse-toggle");
  label.setAttribute("role", "button");
  label.tabIndex = 0;

  const apply = (c: boolean): void => setFolded(host, c);
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
