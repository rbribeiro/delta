import { textContent, titleOf, type ElementNode } from "./ast";
import type { LabelEntry } from "./context";
import { AID_TAGS, RESULT_TAGS } from "./understanding";

/**
 * The proof graph: which results a result's statement or proof leans on, and how much
 * each one can be trusted. Nothing new is written in the source. The graph is read off
 * the refs the compiler already resolves:
 *
 * - nodes are the numbered results and definitions that carry an `id`;
 * - a `<ref to="u">` (or `\ref{u}` / `\eqref{u}` in math) inside the statement or the
 *   `<proof of>` of v gives the edge u → v. A ref to an equation or figure counts for
 *   the result that contains it. Refs inside `<intuition>`, `<strategy>`, `<obstacle>`
 *   and `<heuristic>` are narrative, not reasoning, and give no edge;
 * - trust is ordered `open < heuristic < sketch < verified < formalized`. A node's own
 *   trust is its proof's status (`open` with no proof; definitions are `verified`), and
 *   its effective trust is the weakest of its own and its parents' effective trust: a
 *   result is only as solid as its weakest ancestor. A node on a cycle is `open`.
 *
 * Built once per compile, after numbering (so labels are known) and before rendering (so
 * math is still source text). The CLI's outline/show/uses/graph/lint read it.
 */

export const TRUST = ["open", "heuristic", "sketch", "verified", "formalized"] as const;
export type Trust = (typeof TRUST)[number];

export const trustRank = (t: Trust): number => TRUST.indexOf(t);
const weaker = (a: Trust, b: Trust): Trust => (trustRank(a) <= trustRank(b) ? a : b);

/**
 * A proof's `status` → trust. The collaboration vocabulary maps in (`draft` reads as
 * heuristic, `review` as sketch). A proof without a status is a sketch: trust is
 * declared, never assumed.
 */
const TRUST_OF: Record<string, Trust> = {
  draft: "heuristic",
  heuristic: "heuristic",
  sketch: "sketch",
  review: "sketch",
  verified: "verified",
  formalized: "formalized",
};

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
}

export interface OutlineEntry {
  tag: string;
  id?: string;
  num: string;
  title: string;
  loc: Loc;
  children: OutlineEntry[];
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
}

export interface GraphInput {
  doc: ElementNode;
  ctx: { file: string; sources: Map<string, string> };
}

const CONTAINERS = new Set(["chapter", "section", "subsection", "subsubsection"]);
/** Not reasoning, never numbered: skipped entirely (as numbering.ts does). */
const OPAQUE = new Set(["comment", "todo", "old"]);
/** Literal code: a `\ref` in it is text. */
const LITERAL = new Set(["code", "c"]);
const MATH_REF = /\\(?:eq)?ref\{([^}]*)\}/g;

export function buildGraph(files: GraphInput[], registry: Map<string, LabelEntry>): ProofGraph {
  const graph: ProofGraph = {
    nodes: new Map(),
    dangling: [],
    cycles: [],
    strayProofs: [],
    outline: [],
    byId: new Map(),
    sources: new Map(),
  };
  for (const f of files) for (const [file, text] of f.ctx.sources) graph.sources.set(file, text);
  const locOf = locator(graph.sources);

  // Pass 1: nodes, proofs, the outline, and for every id the result that owns it.
  const proofsOf = new Map<string, ElementNode[]>();
  const ownerOf = new Map<string, string>();
  const collect = (el: ElementNode, into: OutlineEntry[], owner: string | undefined, fallback: string): void => {
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
      });
      into.push({ tag: el.tag, id, num: el.attrs.num ?? "", title: titleText(el), loc, children: [] });
      owner = id;
    } else if (CONTAINERS.has(el.tag)) {
      const entry: OutlineEntry = { tag: el.tag, id, num: el.attrs.num ?? "", title: titleText(el), loc: locOf(el, fallback), children: [] };
      into.push(entry);
      nextInto = entry.children;
    } else if (el.tag === "proof" && el.attrs.of !== undefined) {
      const list = proofsOf.get(el.attrs.of) ?? [];
      list.push(el);
      proofsOf.set(el.attrs.of, list);
      owner = el.attrs.of;
    }
    if (id !== undefined && owner !== undefined && !ownerOf.has(id)) ownerOf.set(id, owner);
    for (const c of el.children) if (c.type === "element") collect(c, nextInto, owner, fallback);
  };
  for (const f of files) {
    const entries: OutlineEntry[] = [];
    collect(f.doc, entries, undefined, f.ctx.file);
    graph.outline.push({ file: f.ctx.file, entries });
  }

  // Own trust.
  for (const node of graph.nodes.values()) {
    node.proofs = proofsOf.get(node.id) ?? [];
    if (node.tag === "definition") node.own = "verified";
    else if (node.proofs.length === 0) node.own = "open";
    else node.own = TRUST_OF[node.proofs[0].attrs.status ?? ""] ?? "sketch";
  }
  for (const [of, proofs] of proofsOf) {
    if (!graph.nodes.has(of)) for (const p of proofs) graph.strayProofs.push({ of, loc: locOf(p, "") });
  }

  // Pass 2: refs → edges (and dangling refs anywhere).
  const edge = (u: string, v: string): void => {
    const from = graph.nodes.get(u)!;
    const to = graph.nodes.get(v)!;
    if (!to.parents.includes(u)) to.parents.push(u);
    if (!from.children.includes(v)) from.children.push(v);
  };
  const use = (target: string, at: ElementNode, node: string | undefined, fallback: string): void => {
    if (!registry.has(target)) {
      graph.dangling.push({ to: target, loc: locOf(at, fallback) });
      return;
    }
    if (node === undefined) return;
    const u = graph.nodes.has(target) ? target : ownerOf.get(target);
    if (u !== undefined && u !== node && graph.nodes.has(u)) edge(u, node);
  };
  const scan = (el: ElementNode, node: string | undefined, fallback: string): void => {
    if (OPAQUE.has(el.tag) || LITERAL.has(el.tag)) return;
    if (RESULT_TAGS.has(el.tag) && el.attrs.id !== undefined && graph.nodes.get(el.attrs.id)?.el === el) node = el.attrs.id;
    else if (el.tag === "proof" && el.attrs.of !== undefined) node = graph.nodes.has(el.attrs.of) ? el.attrs.of : undefined;
    else if (AID_TAGS.has(el.tag)) node = undefined; // narrative: still checked for dangling refs
    if (el.tag === "ref" && el.attrs.to) use(el.attrs.to, el, node, fallback);
    for (const c of el.children) {
      if (c.type === "element") scan(c, node, fallback);
      else if (c.type === "text") for (const m of c.text.matchAll(MATH_REF)) use(m[1], el, node, fallback);
    }
  };
  for (const f of files) scan(f.doc, undefined, f.ctx.file);

  markCycles(graph);
  propagate(graph);
  return graph;
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

/**
 * Results whose own proof is marked verified (or formalized) but whose effective trust is
 * lower, each with the ancestors to blame: those whose own trust is below verified, or
 * that sit on a cycle.
 */
export function overclaimed(graph: ProofGraph): { node: GraphNode; blame: string[] }[] {
  const verified = trustRank("verified");
  return [...graph.nodes.values()]
    .filter((n) => n.tag !== "definition" && trustRank(n.own) >= verified && trustRank(n.eff) < verified)
    .map((node) => ({
      node,
      blame: ancestors(graph, node.id).filter((a) => {
        const up = graph.nodes.get(a)!;
        return up.cyclic || trustRank(up.own) < verified;
      }),
    }));
}

function titleText(el: ElementNode): string {
  const t = titleOf(el);
  return t ? textContent(t).replace(/\s+/g, " ").trim() : "";
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
