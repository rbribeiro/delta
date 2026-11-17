/**
 * The two marks the proof graph writes into the tree once it is built: graph.ts builds the
 * model and reads the tree; these change it. `buildGraph` runs them last, so every pass after
 * it (the ref pass, emit) sees a stale proof's status and each hypothesis's uses.
 */

import { element as el, type ElementNode } from "./ast.ts";
import type { ProofGraph } from "./graph.ts";
import { STALE_STATUS } from "../language/trust.ts";

/**
 * Gives each hypothesis the facts its ref preview shows: where the proof uses it (a ref
 * per step, or "the proof"), or that it does not; and the counterexamples showing it is
 * needed. They go in as a `<hyp-uses>` child, hidden in the page and shown only when the
 * hypothesis is the target of a preview (proofmap.css / hyp CSS). Runs before the ref pass,
 * so the refs in it resolve like any other.
 */
export function annotateHypotheses(graph: ProofGraph): void {
  for (const h of graph.hypotheses.values()) {
    const parts: ElementNode[] = [];
    const proved = (graph.nodes.get(h.owner)?.proofs.length ?? 0) > 0;
    if (h.uses.length) {
      parts.push(
        el(
          "hyp-used",
          {},
          h.uses.map((w) =>
            w.tag === "step" && w.attrs.id ? el("ref", { to: w.attrs.id }) : el("hyp-in-proof"),
          ),
        ),
      );
    } else if (proved) {
      parts.push(el("hyp-unused"));
    }
    const ces = h.counterexamples.filter((c) => c.attrs.id);
    if (ces.length)
      parts.push(
        el(
          "hyp-needed",
          {},
          ces.map((c) => el("ref", { to: c.attrs.id })),
        ),
      );
    if (parts.length) h.el.children.push(el("hyp-uses", {}, parts));
  }
}

/**
 * Shows a stale verification for what it is: the proof's `status` becomes `stale` (the
 * pill reads "Stale", `delta review` lists it). Its `against` stays for `delta verify`.
 */
export function markStale(graph: ProofGraph): void {
  for (const n of graph.nodes.values()) if (n.stale) n.proofs[0].attrs.status = STALE_STATUS;
}
