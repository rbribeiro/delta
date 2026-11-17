/**
 * Folding: a host made collapsible by `collapsible`/`collapsed`, its toggle kept in step, and
 * the ancestors a jump has to open. The caret and the hiding live in collapse.css. Also the
 * one rule for an element that acts like a button without being one (`asToggle`).
 */

/**
 * Runs `activate` on Enter or Space **aimed at `el` itself**, and cancels the key so the page
 * does not scroll. A key pressed on a control inside `el` (a comment marker in a heading, a
 * button in a proof's bar) belongs to that control, so it is left alone.
 */
export function onActivate(el: HTMLElement, activate: () => void): void {
  el.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.target !== el || (e.key !== "Enter" && e.key !== " ")) return;
    e.preventDefault();
    activate();
  });
}

/**
 * Makes `el` (a heading, a box tag, a step's head) work as a toggle button: announced as a
 * button, reachable with Tab, run by a click or by Enter/Space (`onActivate`).
 */
export function asToggle(el: HTMLElement, flip: () => void): void {
  el.setAttribute("role", "button");
  el.tabIndex = 0;
  el.addEventListener("click", flip);
  onActivate(el, flip);
}

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
  const apply = (c: boolean): void => setFolded(host, c);
  asToggle(label, () => apply(!host.classList.contains("is-collapsed")));
  apply(collapsed);
}

/** How long the paper takes to fold back (the `*-refold` animations in the CSS) before it shuts. */
export const REFOLD_MS = 380;
const refolds = new WeakMap<Element, number>();

/**
 * The paper's fold motion on `el`, shared by the reader aids and the proof steps. `done`
 * opens or shuts the fold itself:
 *
 *   opening   `done` runs at once, and `is-unfolding` plays (the caller removes it when the
 *             animation ends: only it knows which element animates);
 *   closing   `is-refolding` plays for REFOLD_MS, then `done` shuts the fold.
 *
 * Without `animate`, or when the reader asked for less motion, `done` runs at once and no
 * class is added. A new call cancels a refold still under way.
 */
export function foldMotion(
  el: HTMLElement,
  opening: boolean,
  animate: boolean,
  done: () => void,
): void {
  clearTimeout(refolds.get(el));
  el.classList.remove("is-unfolding", "is-refolding");
  const moving = animate && !matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (opening) {
    done();
    if (moving) el.classList.add("is-unfolding");
    return;
  }
  if (!moving) return done();
  el.classList.add("is-refolding");
  refolds.set(
    el,
    window.setTimeout(() => {
      el.classList.remove("is-refolding");
      done();
    }, REFOLD_MS),
  );
}
