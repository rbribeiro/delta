/**
 * What the CLI's graph commands work out about the proof graph: the frontier (`delta graph
 * --frontier`), the results that claim more than they rest on, and every lint finding. Facts,
 * not formatting: graph-report.ts turns them into text or JSON.
 */

import type { Diagnostic } from "./compiler/context.ts";
import { ancestors, type GraphNode, type Loc, type ProofGraph } from "./compiler/graph.ts";
import { trustRank } from "./language/trust.ts";

/** How a path is shown: the CLI makes it relative to where the reader stands. */
export type Rel = (file: string) => string;

/** Work available now: own trust below verified, every parent at least a sketch. */
export function frontier(graph: ProofGraph): GraphNode[] {
  const sketch = trustRank("sketch");
  return [...graph.nodes.values()].filter(
    (n) =>
      n.tag !== "definition" &&
      !n.cyclic &&
      trustRank(n.own) <= sketch &&
      n.parents.every((p) => trustRank(graph.nodes.get(p)!.eff) >= sketch),
  );
}

export interface Finding {
  severity: "error" | "warning";
  kind: string;
  message: string;
  file: string;
  line?: number;
  /** The results involved (the cycle's path, the ancestors to blame, …). */
  ids?: string[];
}

/**
 * Results whose own proof is marked verified (or formalized) but whose effective trust is
 * lower, each with the ancestors to blame: those whose own trust is below verified, or
 * that sit on a cycle.
 */
export function overclaimed(graph: ProofGraph): { node: GraphNode; blame: string[] }[] {
  const verified = trustRank("verified");
  return [...graph.nodes.values()]
    .filter(
      (n) => n.tag !== "definition" && trustRank(n.own) >= verified && trustRank(n.eff) < verified,
    )
    .map((node) => ({
      node,
      blame: ancestors(graph, node.id).filter((a) => {
        const up = graph.nodes.get(a)!;
        return up.cyclic || trustRank(up.own) < verified;
      }),
    }));
}

/**
 * Everything wrong with the proof's structure: circular reasoning, dangling refs, results
 * marked verified that rest on something weaker, proofs of nothing, several proofs of one
 * result, and every compile diagnostic (misplaced elements among them). Compile warnings
 * that restate a dangling ref are dropped: the graph reports those with better context.
 */
export function lintFindings(graph: ProofGraph, diagnostics: Diagnostic[], rel: Rel): Finding[] {
  const out: Finding[] = [];
  const at = (loc: Loc) => ({ file: rel(loc.file), line: loc.line });

  for (const cycle of graph.cycles) {
    const first = graph.nodes.get(cycle[0])!;
    out.push({
      severity: "error",
      kind: "cycle",
      message: `circular reasoning: ${cycle.join(" → ")}`,
      ...at(first.loc),
      ids: cycle,
    });
  }
  for (const d of graph.dangling) {
    out.push({
      severity: "error",
      kind: "dangling-ref",
      message: `ref to "${d.to}", which no element defines`,
      ...at(d.loc),
      ids: [d.to],
    });
  }
  for (const { node, blame } of overclaimed(graph)) {
    const why = blame
      .map((b) => {
        const up = graph.nodes.get(b)!;
        return `${b} (${up.own}${up.cyclic ? ", on a cycle" : ""})`;
      })
      .join(", ");
    out.push({
      severity: "error",
      kind: "overclaimed",
      message: `${node.id} is marked ${node.own} but rests on ${why}: effective status is ${node.eff}`,
      ...at(node.loc),
      ids: [node.id, ...blame],
    });
  }
  for (const n of graph.nodes.values()) {
    const against = n.proofs[0]?.attrs.against;
    if (n.stale) {
      out.push({
        severity: "error",
        kind: "stale",
        message: `${n.id}'s verification is stale: its statement, its proof, or a statement it uses changed since it was checked (against ${against}, now ${n.hash}); check it again and run delta verify ${n.id}`,
        ...at(n.loc),
        ids: [n.id],
      });
    } else if (
      n.tag !== "definition" &&
      against === undefined &&
      ["verified", "formalized"].includes(n.proofs[0]?.attrs.status ?? "")
    ) {
      out.push({
        severity: "warning",
        kind: "unpinned",
        message: `${n.id} is marked ${n.proofs[0].attrs.status} by hand, with no against= hash, so a later edit cannot be detected; run delta verify ${n.id}`,
        ...at(n.loc),
        ids: [n.id],
      });
    }
  }
  for (const h of graph.hypotheses.values()) {
    const owner = graph.nodes.get(h.owner);
    if (owner && owner.proofs.length > 0 && h.uses.length === 0) {
      out.push({
        severity: "warning",
        kind: "unused-hypothesis",
        message: `(${h.num}) ${h.id} of ${h.owner} is never used in its proof: either a step is missing, or the result holds without it`,
        ...at(h.loc),
        ids: [h.id, h.owner],
      });
    }
  }
  for (const b of graph.badBreaks) {
    out.push({
      severity: "error",
      kind: "bad-counterexample",
      message: `<counterexample breaks="${b.breaks}">: no hypothesis has that id`,
      ...at(b.loc),
      ids: [b.breaks],
    });
  }
  for (const s of graph.unprovedSteps) {
    out.push({
      severity: "warning",
      kind: "unproved-step",
      message: `step ${s.num}${s.owner ? ` of ${s.owner}` : ""} has a claim but no proof`,
      ...at(s.loc),
      ...(s.id ? { ids: [s.id] } : {}),
    });
  }
  for (const s of graph.strayProofs) {
    out.push({
      severity: "warning",
      kind: "stray-proof",
      message: `<proof of="${s.of}"> does not prove a result in the graph`,
      ...at(s.loc),
      ids: [s.of],
    });
  }
  for (const n of graph.nodes.values()) {
    if (n.proofs.length > 1) {
      out.push({
        severity: "warning",
        kind: "several-proofs",
        message: `${n.id} has ${n.proofs.length} proofs; the first sets its status`,
        ...at(n.loc),
        ids: [n.id],
      });
    }
    if (n.el.attrs.status === "open" && n.proofs.length > 0) {
      out.push({
        severity: "warning",
        kind: "open-with-proof",
        message: `${n.id} is status="open" but has a proof; drop the status`,
        ...at(n.loc),
        ids: [n.id],
      });
    }
  }
  for (const d of diagnostics) {
    if (d.code === "unresolved-ref") continue; // reported above, as a dangling reference
    out.push({
      severity: d.severity,
      kind: "compile",
      message: d.message,
      file: rel(d.file),
      ...(d.pos ? { line: d.pos.line } : {}),
    });
  }
  return out;
}
