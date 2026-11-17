/**
 * The DOM contracts between elements: the places where one element relies on chrome another
 * element built. Each is named here, once, so renaming a class in one element cannot silently
 * break another, and so a student can see in one page what of another element's chrome they
 * may rely on.
 *
 *   the preview body    ref.ts builds `.xref-pop-body`, where a target's snapshot is shown;
 *                       elements inside a snapshot draw less (no folds, no controls)
 *   a target's heading  section.ts builds `<h1>`…`<h4>` as a section's first child
 *   a target's label    the heading, or what environment.ts builds for a box
 *                       (`.box-sheet > .box-head`) and a proof (`.proof-lead`, `.proof-bar`)
 */

/** The class of the body of a reference preview (built by ref.ts). */
export const PREVIEW_BODY = "xref-pop-body";

/** True when `el` is part of a reference preview: a clone, shown statically. */
export function insidePreview(el: Element): boolean {
  return el.closest(`.${PREVIEW_BODY}`) !== null;
}

/** True when `el` is the snapshot itself, the root of a preview (not something nested in it). */
export function isPreviewRoot(el: Element): boolean {
  return el.parentElement?.classList.contains(PREVIEW_BODY) ?? false;
}

const HEADING = ":scope > h1, :scope > h2, :scope > h3, :scope > h4";

/** The heading of a section-like target (section.ts), or null. */
export function headingOf(target: Element): HTMLElement | null {
  return target.querySelector<HTMLElement>(HEADING);
}

/**
 * The label of a target, where an inline mark anchored with `on="id"` goes: a box's header,
 * a section's heading, or a proof's lead or bar. Null when the target has none.
 */
export function labelSlot(target: Element): HTMLElement | null {
  return target.querySelector<HTMLElement>(
    `:scope > .box-sheet > .box-head, ${HEADING}, :scope > .proof-lead, :scope > .proof-bar`,
  );
}
