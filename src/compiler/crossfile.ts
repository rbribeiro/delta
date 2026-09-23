import { elements, type ElementNode } from "./ast";
import { REF_TAGS } from "./references";

/**
 * The project-wide id maps and the two annotators that make links work *across* output files.
 *
 * A project compiles many `.dlt` files into many HTML files that must still behave as one
 * work: a `<ref>` in chapter 2 can point at a theorem in chapter 1. The pop-over preview is
 * solved by copying the target into every output that references it (emit snapshots from
 * `globalById`); the *jump* is solved by writing the target's home output onto the node
 * (`data-target-href`), which the runtime navigates to. With a single file every id lives in
 * the one output, so nothing here fires.
 */

/**
 * Records, project-wide, the first node carrying each id and the output file it lives in.
 * Runs once after numbering (and the bibliography fill), when node identities are stable.
 * Invariant for every later pass: mutate element nodes in place, never replace them — the
 * emitter snapshots straight from `globalById`.
 */
export function buildIdMaps(
  files: { doc: ElementNode; outName: string }[],
  globalById: Map<string, ElementNode>,
  idToFile: Map<string, string>,
): void {
  for (const f of files) {
    for (const el of elements(f.doc)) {
      const id = el.attrs.id;
      if (id && !globalById.has(id)) {
        globalById.set(id, el);
        idToFile.set(id, f.outName);
      }
    }
  }
}

/**
 * For a resolved `<ref>`/`<solution>`/`<proof>` whose target lives in another output, records
 * `data-target-href="<file>#<id>"` so the runtime navigates there instead of scrolling in
 * page. Same-file refs are left alone; unresolved ones stay inert.
 */
export function annotateCrossFileRefs(
  doc: ElementNode,
  outName: string,
  idToFile: Map<string, string>,
): void {
  for (const el of elements(doc)) {
    if (!REF_TAGS.has(el.tag)) continue;
    if (el.attrs["data-target-num"] === undefined) continue; // unresolved: leave bare
    const to = el.tag === "ref" ? el.attrs.to : el.attrs.of;
    const home = to ? idToFile.get(to) : undefined;
    if (home && home !== outName) el.attrs["data-target-href"] = `${home}#${to}`;
  }
}

/** Records the references list's output on each resolved `<cite>` that lives in another file. */
export function annotateCrossFileCites(doc: ElementNode, bibOut: string): void {
  for (const el of elements(doc)) {
    if (el.tag !== "cite") continue;
    if (el.attrs["data-cite-nums"] === undefined) continue; // unresolved: leave inert
    el.attrs["data-cite-file"] = bibOut;
  }
}
