import type { ElementNode } from "./ast.ts";
import type { CompileContext } from "./context.ts";
import type { ProofGraph } from "./graph.ts";
import { HEADING_TAGS, OPAQUE, RAW_TAGS } from "../language/tags.ts";

/**
 * Tells a result's box where its proof is when the reader cannot see it. A proof joined to
 * the box (`linkProofs`) is drawn as its footer; any other result gets a footer of its own:
 *
 *   data-proof-at="lem:x-proof"                 its first proof is elsewhere: the proof's id,
 *   data-proof-at-tag="section"                 and the heading it sits under ("proof" and
 *   data-proof-at-num="2.3"                     no number when that is the result's own
 *   data-proof-at-href="cap3.html#lem:x-proof"  heading); the href only across files
 *   data-proof="pending"                        status="open" and no proof (not in --final)
 *
 * The runtime turns the first into "Proof in Section 2.3", a ref to the proof previewed like
 * any other (so the proof's id joins `referencedIds`, which ships its snapshot). Runs after
 * the graph, which knows every result's proofs across the project.
 */
export function linkRemoteProofs(
  files: { doc: ElementNode; ctx: CompileContext; outName: string }[],
  graph: ProofGraph,
  idToFile: Map<string, string>,
  final: boolean,
): void {
  // The heading each proof and each result sits under, and the file it is in.
  const where = new Map<ElementNode, { heading?: ElementNode; file: (typeof files)[number] }>();
  for (const file of files) {
    const visit = (el: ElementNode, heading: ElementNode | undefined): void => {
      if (RAW_TAGS.has(el.tag) || OPAQUE.has(el.tag)) return;
      where.set(el, { heading, file });
      const inner = HEADING_TAGS.has(el.tag) ? el : heading;
      for (const c of el.children) if (c.type === "element") visit(c, inner);
    };
    visit(file.doc, undefined);
  }

  for (const node of graph.nodes.values()) {
    const el = node.el;
    const at = where.get(el);
    if (!at || node.proofs.some((p) => p.attrs["data-attached"] === "true")) continue;
    const proof = node.proofs[0];
    const id = proof?.attrs.id;
    if (proof && id) {
      const heading = where.get(proof)?.heading;
      const sameHeading = heading === at.heading || heading?.attrs.num === undefined;
      el.attrs["data-proof-at"] = id;
      el.attrs["data-proof-at-tag"] = sameHeading ? "proof" : heading!.tag;
      el.attrs["data-proof-at-num"] = sameHeading ? "" : heading!.attrs.num!;
      const home = idToFile.get(id);
      if (home && home !== at.file.outName) el.attrs["data-proof-at-href"] = `${home}#${id}`;
      at.file.ctx.referencedIds.add(id);
    } else if (!proof && el.attrs.status === "open" && !final) {
      el.attrs["data-proof"] = "pending";
    }
  }
}
