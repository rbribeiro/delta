import { element as el, textContent, titleOf, type ElementNode } from "./ast.ts";
import type { LabelEntry } from "./context.ts";
import {
  AID_TAGS,
  HEADING_TAGS,
  LITERAL_TAGS,
  MATH_REF,
  OPAQUE,
  RESULT_TAGS,
} from "../language/tags.ts";
import { TRUST_OF, trustRank, weaker, type Trust } from "../language/trust.ts";
import { checkedHash } from "./graph-hash.ts";
import { collapseSpace, flow, proofTarget } from "./paper.ts";

/**
 * The proof graph: which results a result's statement or proof leans on, and how much
 * each one can be trusted. Nothing new is written in the source. The graph is read off
 * the refs the compiler already resolves:
 *
 * - nodes are the numbered results and definitions that carry an `id`;
 * - a `<ref to="u">` (or `\ref{u}` / `\eqref{u}` in math) inside the statement or the
 *   proof of v (its `of`, or the result right before it: `proofTarget`) gives the edge
 *   u → v. A ref to an equation or figure counts for the result that contains it. Refs
 *   inside `<intuition>`, `<strategy>` and `<obstacle>` are narrative, not reasoning, and
 *   give no edge. Refs inside a proof's `<step>`s count for the result the proof proves. A ref to a hypothesis
 *   (`<hyp>`) is not an edge either: it records where the hypothesis is used;
 * - trust is ordered `open < heuristic < sketch < verified < formalized`. A node's own
 *   trust is its proof's status (`open` with no proof; definitions are `verified`), and
 *   its effective trust is the weakest of its own and its parents' effective trust: a
 *   result is only as solid as its weakest ancestor. A node on a cycle is `open`;
 * - a verification is pinned: `delta verify` writes `against="<hash>"` on the proof, the
 *   hash of what was checked (graph-hash.ts). When that changes, the verification is
 *   stale and the proof counts as a sketch until someone verifies it again.
 *
 * Built once per compile, after numbering (so labels are known) and before rendering (so
 * math is still source text). The CLI's outline/show/uses/graph/lint read it; their
 * queries and formatting are in graph-report.ts.
 */

/** Where something is, for `file:line` output. `line` is the line of the opening `<`. */
export interface Loc {
  file: string;
  line: number;
}

export interface GraphNode {
  id: string;
  tag: string;
  num: string;
  title: string;
  loc: Loc;
  el: ElementNode;
  /** Every `<proof of="id">`, in input order; the first one sets the node's own trust. */
  proofs: ElementNode[];
  own: Trust;
  eff: Trust;
  /** Results this one uses (edge u → this), in first-use order. */
  parents: string[];
  /** Results that use this one. */
  children: string[];
  /** True when the node sits on a cycle (circular reasoning). */
  cyclic: boolean;
  /** The hash a verification of this node must match now (graph-hash.ts). */
  hash: string;
  /** The first proof claims verified/formalized against a hash that no longer matches. */
  stale: boolean;
}

export interface OutlineEntry {
  tag: string;
  id?: string;
  num: string;
  title: string;
  loc: Loc;
  children: OutlineEntry[];
}

/** A `<hyp>` in a result's statement, and where the result's proof uses it. */
export interface Hypothesis {
  id: string;
  num: string;
  /** The result whose statement it is in. */
  owner: string;
  el: ElementNode;
  loc: Loc;
  /** Each place the owner's proof refs it: the innermost `<step>`, or the proof itself. */
  uses: ElementNode[];
  /** `<counterexample breaks="id">`s: why the hypothesis is needed. */
  counterexamples: ElementNode[];
}

export interface ProofGraph {
  /** In document order (input files in order). */
  nodes: Map<string, GraphNode>;
  /** Refs to ids nobody defines. */
  dangling: { to: string; loc: Loc }[];
  /** Each cycle as a closed path, `[a, b, a]`. */
  cycles: string[][];
  /** Proofs whose `of` is not a result in the graph. */
  strayProofs: { of: string; loc: Loc }[];
  /** Sections and results, one tree per input file. */
  outline: { file: string; entries: OutlineEntry[] }[];
  /** Every element with an id (first one wins), for `delta show`. */
  byId: Map<string, ElementNode>;
  /** file → original text, for exact source slices. */
  sources: Map<string, string>;
  /** Every hypothesis with an id, in document order. */
  hypotheses: Map<string, Hypothesis>;
  /** `<counterexample breaks>` naming something that is not a hypothesis. */
  badBreaks: { breaks: string; loc: Loc }[];
  /** For every id inside a result or its proof (steps, equations, hypotheses): that result. */
  owners: Map<string, string>;
  /** Steps with a claim but no proof of their own. */
  unprovedSteps: { id: string; num: string; owner?: string; loc: Loc }[];
}

export interface GraphInput {
  doc: ElementNode;
  ctx: { file: string; sources: Map<string, string> };
}

/** `el` → where it is: its file and the line of its opening `<`. */
type Locate = (el: ElementNode, fallback: string) => Loc;

export function buildGraph(files: GraphInput[], registry: Map<string, LabelEntry>): ProofGraph {
  const graph: ProofGraph = {
    nodes: new Map(),
    dangling: [],
    cycles: [],
    strayProofs: [],
    outline: [],
    byId: new Map(),
    sources: new Map(),
    hypotheses: new Map(),
    owners: new Map(),
    badBreaks: [],
    unprovedSteps: [],
  };
  for (const f of files) for (const [file, text] of f.ctx.sources) graph.sources.set(file, text);
  const locOf = locator(graph.sources);

  const proofsOf = collectNodes(graph, files, locOf);
  attachProofs(graph, proofsOf, locOf);
  collectEdges(graph, files, registry, locOf);
  pinVerifications(graph);
  markCycles(graph);
  propagate(graph);
  return graph;
}

/**
 * Walk 1: the nodes (results with an id), the outline, the hypotheses, the unproved steps,
 * and for every id the result that owns it. Returns each result's proofs, in input order.
 */
function collectNodes(
  graph: ProofGraph,
  files: GraphInput[],
  locOf: Locate,
): Map<string, ElementNode[]> {
  const proofsOf = new Map<string, ElementNode[]>();
  const counterexamples: ElementNode[] = [];

  const collect = (
    el: ElementNode,
    into: OutlineEntry[],
    owner: string | undefined,
    fallback: string,
  ): void => {
    if (OPAQUE.has(el.tag)) return;
    const id = el.attrs.id;
    if (id !== undefined && !graph.byId.has(id)) graph.byId.set(id, el);

    let nextInto = into;
    if (RESULT_TAGS.has(el.tag) && id !== undefined && !graph.nodes.has(id)) {
      const loc = locOf(el, fallback);
      graph.nodes.set(id, {
        id,
        tag: el.tag,
        num: el.attrs.num ?? "",
        title: titleText(el),
        loc,
        el,
        proofs: [],
        own: "open",
        eff: "open",
        parents: [],
        children: [],
        cyclic: false,
        hash: "",
        stale: false,
      });
      into.push({
        tag: el.tag,
        id,
        num: el.attrs.num ?? "",
        title: titleText(el),
        loc,
        children: [],
      });
      owner = id;
    } else if (HEADING_TAGS.has(el.tag)) {
      const entry: OutlineEntry = {
        tag: el.tag,
        id,
        num: el.attrs.num ?? "",
        title: titleText(el),
        loc: locOf(el, fallback),
        children: [],
      };
      into.push(entry);
      nextInto = entry.children;
    } else if (el.tag === "proof" && proofTarget(el) !== undefined) {
      const of = proofTarget(el)!;
      const list = proofsOf.get(of) ?? [];
      list.push(el);
      proofsOf.set(of, list);
      owner = of;
    } else if (
      el.tag === "hyp" &&
      id !== undefined &&
      owner !== undefined &&
      !graph.hypotheses.has(id)
    ) {
      graph.hypotheses.set(id, {
        id,
        num: el.attrs.num ?? "",
        owner,
        el,
        loc: locOf(el, fallback),
        uses: [],
        counterexamples: [],
      });
    } else if (el.tag === "counterexample" && el.attrs.breaks) {
      counterexamples.push(el);
    } else if (
      el.tag === "step" &&
      !flow(el).some((c) => c.type === "element" && c.tag === "proof")
    ) {
      graph.unprovedSteps.push({
        id: id ?? "",
        num: el.attrs.num ?? "",
        owner,
        loc: locOf(el, fallback),
      });
    }
    if (id !== undefined && owner !== undefined && !graph.owners.has(id))
      graph.owners.set(id, owner);
    for (const c of el.children) if (c.type === "element") collect(c, nextInto, owner, fallback);
  };
  for (const f of files) {
    const entries: OutlineEntry[] = [];
    collect(f.doc, entries, undefined, f.ctx.file);
    graph.outline.push({ file: f.ctx.file, entries });
  }

  // Counterexamples name hypotheses, which may come later in the document.
  for (const ce of counterexamples) {
    const h = graph.hypotheses.get(ce.attrs.breaks);
    if (h) h.counterexamples.push(ce);
    else graph.badBreaks.push({ breaks: ce.attrs.breaks, loc: locOf(ce, "") });
  }
  return proofsOf;
}

/** Gives each node its proofs and its own trust; a proof of something not in the graph is stray. */
function attachProofs(
  graph: ProofGraph,
  proofsOf: Map<string, ElementNode[]>,
  locOf: Locate,
): void {
  for (const node of graph.nodes.values()) {
    node.proofs = proofsOf.get(node.id) ?? [];
    if (node.tag === "definition") node.own = "verified";
    else if (node.proofs.length === 0) node.own = "open";
    else node.own = TRUST_OF[node.proofs[0].attrs.status ?? ""] ?? "sketch";
  }
  for (const [of, proofs] of proofsOf) {
    if (!graph.nodes.has(of))
      for (const p of proofs) graph.strayProofs.push({ of, loc: locOf(p, "") });
  }
}

/** Walk 2: every ref → an edge (or a hypothesis use, or a dangling ref). */
function collectEdges(
  graph: ProofGraph,
  files: GraphInput[],
  registry: Map<string, LabelEntry>,
  locOf: Locate,
): void {
  const edge = (u: string, v: string): void => {
    const from = graph.nodes.get(u)!;
    const to = graph.nodes.get(v)!;
    if (!to.parents.includes(u)) to.parents.push(u);
    if (!from.children.includes(v)) from.children.push(v);
  };
  const use = (
    target: string,
    at: ElementNode,
    node: string | undefined,
    fallback: string,
    where: ElementNode | undefined,
  ): void => {
    if (!registry.has(target)) {
      graph.dangling.push({ to: target, loc: locOf(at, fallback) });
      return;
    }
    const hyp = graph.hypotheses.get(target);
    if (hyp) {
      // Only the owner's own proof "uses" its hypothesis; elsewhere a ref is just a mention.
      if (where && node === hyp.owner && !hyp.uses.includes(where)) hyp.uses.push(where);
      return;
    }
    if (node === undefined) return;
    const u = graph.nodes.has(target) ? target : graph.owners.get(target);
    if (u !== undefined && u !== node && graph.nodes.has(u)) edge(u, node);
  };
  /** `where`: inside a proof, the innermost step (or the proof itself), for hypothesis uses. */
  const scan = (
    el: ElementNode,
    node: string | undefined,
    fallback: string,
    where: ElementNode | undefined,
  ): void => {
    if (OPAQUE.has(el.tag) || LITERAL_TAGS.has(el.tag)) return;
    if (
      RESULT_TAGS.has(el.tag) &&
      el.attrs.id !== undefined &&
      graph.nodes.get(el.attrs.id)?.el === el
    ) {
      node = el.attrs.id;
      where = undefined;
    } else if (el.tag === "proof" && proofTarget(el) !== undefined) {
      node = graph.nodes.has(proofTarget(el)!) ? proofTarget(el) : undefined;
      where = el;
    } else if (el.tag === "step") {
      where = el;
    } else if (AID_TAGS.has(el.tag)) {
      node = undefined; // narrative: still checked for dangling refs
    }
    if (el.tag === "ref" && el.attrs.to) use(el.attrs.to, el, node, fallback, where);
    for (const c of el.children) {
      if (c.type === "element") scan(c, node, fallback, where);
      else if (c.type === "text")
        for (const m of c.text.matchAll(MATH_REF)) use(m[2], el, node, fallback, where);
    }
  };
  for (const f of files) scan(f.doc, undefined, f.ctx.file, undefined);
}

/** A proof verified against an old hash (graph-hash.ts) counts as a sketch again. */
function pinVerifications(graph: ProofGraph): void {
  for (const n of graph.nodes.values()) {
    n.hash = checkedHash(graph, n);
    const against = n.proofs[0]?.attrs.against;
    if (against !== undefined && trustRank(n.own) >= trustRank("verified") && against !== n.hash) {
      n.stale = true;
      n.own = "sketch";
    }
  }
}

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
  for (const n of graph.nodes.values()) if (n.stale) n.proofs[0].attrs.status = "stale";
}

/** Tarjan's SCCs; each non-trivial one is reported once, as one closed path through it. */
function markCycles(graph: ProofGraph): void {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  let next = 0;
  const strong = (v: string): void => {
    index.set(v, next);
    low.set(v, next++);
    stack.push(v);
    onStack.add(v);
    for (const w of graph.nodes.get(v)!.children) {
      if (!index.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, index.get(w)!));
      }
    }
    if (low.get(v) !== index.get(v)) return;
    const scc: string[] = [];
    let w: string;
    do {
      w = stack.pop()!;
      onStack.delete(w);
      scc.push(w);
    } while (w !== v);
    if (scc.length < 2) return;
    const members = new Set(scc);
    for (const id of scc) graph.nodes.get(id)!.cyclic = true;
    graph.cycles.push(closedPath(graph, v, members));
  };
  for (const id of graph.nodes.keys()) if (!index.has(id)) strong(id);
}

/** A path start → … → start inside one strongly connected component (BFS, so a shortest one). */
function closedPath(graph: ProofGraph, start: string, members: Set<string>): string[] {
  const prev = new Map<string, string>();
  const queue = [start];
  while (queue.length) {
    const v = queue.shift()!;
    for (const w of graph.nodes.get(v)!.children) {
      if (!members.has(w)) continue;
      if (w === start) {
        const path = [start];
        for (let at = v; at !== start; at = prev.get(at)!) path.unshift(at);
        path.unshift(start);
        return path;
      }
      if (!prev.has(w)) {
        prev.set(w, v);
        queue.push(w);
      }
    }
  }
  return [start, start];
}

/** eff(v) = own(v) ∧ min over parents eff(u), to a fixpoint (it only ever decreases). */
function propagate(graph: ProofGraph): void {
  for (const n of graph.nodes.values()) n.eff = n.cyclic ? "open" : n.own;
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of graph.nodes.values()) {
      let e = n.eff;
      for (const p of n.parents) e = weaker(e, graph.nodes.get(p)!.eff);
      if (e !== n.eff) {
        n.eff = e;
        changed = true;
      }
    }
  }
}

/** Every ancestor of `id` (transitively), nearest first. */
export function ancestors(graph: ProofGraph, id: string): string[] {
  return reach(graph, id, (n) => n.parents);
}

/** Everything downstream of `id` (transitively), nearest first. */
export function descendants(graph: ProofGraph, id: string): string[] {
  return reach(graph, id, (n) => n.children);
}

function reach(graph: ProofGraph, id: string, next: (n: GraphNode) => string[]): string[] {
  const seen = new Set<string>([id]);
  const out: string[] = [];
  const queue = [id];
  while (queue.length) {
    for (const w of next(graph.nodes.get(queue.shift()!)!)) {
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(w);
      queue.push(w);
    }
  }
  return out;
}

function titleText(el: ElementNode): string {
  const t = titleOf(el);
  return t ? collapseSpace(textContent(t)) : "";
}

/** `el` → its file and the line of its opening `<` (from the source span when there is one). */
function locator(sources: Map<string, string>): (el: ElementNode, fallback: string) => Loc {
  const newlines = new Map<string, number[]>();
  const lineAt = (file: string, offset: number): number | undefined => {
    const text = sources.get(file);
    if (text === undefined) return undefined;
    let nl = newlines.get(file);
    if (!nl) {
      nl = [];
      for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) nl.push(i);
      newlines.set(file, nl);
    }
    let lo = 0;
    let hi = nl.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (nl[mid] < offset) lo = mid + 1;
      else hi = mid;
    }
    return lo + 1;
  };
  return (el, fallback) => {
    const file = el.src?.file ?? el.pos?.file ?? fallback;
    const line = (el.src && lineAt(el.src.file, el.src.start)) ?? el.pos?.line ?? 0;
    return { file, line };
  };
}
