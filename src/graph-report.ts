import type { ElementNode } from "./compiler/ast.ts";
import {
  descendants,
  type GraphNode,
  type Loc,
  type OutlineEntry,
  type ProofGraph,
} from "./compiler/graph.ts";
import { AID_TAGS, PROOF_TAGS } from "./language/tags.ts";
import { frontier, type Finding, type Rel } from "./graph-analysis.ts";
import { lineIndex } from "./compiler/lines.ts";

/** A parent's statement as `--context` shows it: no aids, no proof nested in it. */
const NOT_STATEMENT: ReadonlySet<string> = new Set([...AID_TAGS, ...PROOF_TAGS]);

/**
 * The agent-facing views of the proof graph: `delta outline`, `show`, `uses`, `graph` and
 * `lint`, each as text or JSON. What they report is worked out in graph-analysis.ts. Pure functions (no I/O) over the graph the compiler built,
 * so the CLI is a thin shell and tests need no process. Paths go through `rel`, so the CLI
 * prints them relative to where the agent stands.
 */

const where = (loc: Loc, rel: Rel): string => `${rel(loc.file)}:${loc.line}`;
const label = (n: GraphNode): string => `${n.tag}${n.num ? ` ${n.num}` : ""}`;
const title = (n: { title: string }): string => (n.title ? ` (${n.title})` : "");
/** `sketch` when own = eff, `sketch → open` when an ancestor pulls it down. */
const trust = (n: GraphNode): string =>
  (n.own === n.eff ? n.eff : `${n.own} → ${n.eff}`) +
  (n.stale ? ", stale" : "") +
  (n.cyclic ? ", cyclic" : "");

function nodeJson(n: GraphNode, rel: Rel): Record<string, unknown> {
  return {
    id: n.id,
    tag: n.tag,
    num: n.num,
    title: n.title,
    own: n.own,
    eff: n.eff,
    file: rel(n.loc.file),
    line: n.loc.line,
    parents: n.parents,
    children: n.children,
    ...(n.cyclic ? { cyclic: true } : {}),
    ...(n.stale ? { stale: true } : {}),
    hash: n.hash,
  };
}

// -- outline -------------------------------------------------------------

export function outlineText(graph: ProofGraph, rel: Rel): string {
  const out: string[] = [];
  const walk = (entries: OutlineEntry[], depth: number): void => {
    for (const e of entries) {
      const pad = "  ".repeat(depth);
      const node = e.id !== undefined ? graph.nodes.get(e.id) : undefined;
      if (node && node.el.tag === e.tag) {
        out.push(
          `${pad}${label(node)} ${node.id}${title(node)} [${trust(node)}] ${where(node.loc, rel)}`,
        );
      } else {
        out.push(
          `${pad}${e.num ? `${e.num} ` : ""}${e.title || `<${e.tag}>`} ${where(e.loc, rel)}`,
        );
      }
      walk(e.children, depth + 1);
    }
  };
  for (const f of graph.outline) {
    out.push(rel(f.file));
    walk(f.entries, 1);
  }
  return out.join("\n") + "\n";
}

export function outlineJson(graph: ProofGraph, rel: Rel): unknown {
  const entry = (e: OutlineEntry): unknown => {
    const node = e.id !== undefined ? graph.nodes.get(e.id) : undefined;
    const base = {
      tag: e.tag,
      ...(e.id !== undefined ? { id: e.id } : {}),
      num: e.num,
      title: e.title,
      file: rel(e.loc.file),
      line: e.loc.line,
    };
    if (node && node.el.tag === e.tag) return { ...base, own: node.own, eff: node.eff };
    return { ...base, children: e.children.map(entry) };
  };
  return {
    files: graph.outline.map((f) => ({ file: rel(f.file), entries: f.entries.map(entry) })),
  };
}

// -- show ------------------------------------------------------------------

/** One element's exact source text, dedented, with the file and line range it came from. */
export interface Slice {
  file: string;
  line: number;
  endLine: number;
  source: string;
}

/**
 * The source of `el` as the author wrote it. With `drop`, the direct children with those
 * tags are cut out (and the lines they leave empty), which is how a parent's *statement*
 * is shown without its narrative aids.
 */
export function sliceOf(
  graph: ProofGraph,
  el: ElementNode,
  rel: Rel,
  drop?: ReadonlySet<string>,
): Slice | undefined {
  const span = el.src;
  const text = span && graph.sources.get(span.file);
  if (!span || text === undefined) return undefined;

  const cuts: [number, number][] = [];
  for (const c of el.children) {
    if (c.type !== "element" || !drop?.has(c.tag) || !c.src) continue;
    let s = c.src.start;
    let e = c.src.end;
    while (s > span.start && (text[s - 1] === " " || text[s - 1] === "\t")) s--;
    const rest = /^[ \t]*\n/.exec(text.slice(e));
    if (text[s - 1] === "\n" && rest) e += rest[0].length;
    cuts.push([s, e]);
  }
  let body = "";
  let at = span.start;
  for (const [s, e] of cuts) {
    body += text.slice(at, s);
    at = e;
  }
  body += text.slice(at, span.end);

  // Dedent by the indentation of the line the element opens on.
  const lines = lineIndex(text);
  const lineStart = lines.startOf(span.start);
  const indent = /^[ \t]*/.exec(text.slice(lineStart, span.start))![0].length;
  const source = body
    .split("\n")
    .map((l, i) => (i === 0 ? l : l.replace(new RegExp(`^[ \\t]{0,${indent}}`), "")))
    .join("\n");

  return {
    file: rel(span.file),
    line: lines.lineOf(span.start),
    endLine: lines.lineOf(span.end),
    source,
  };
}

export interface ShowData {
  id: string;
  node?: GraphNode;
  /** For an id inside a result or its proof (a step, a hypothesis…): that result. */
  owner?: GraphNode;
  /** The element's tag and number, for a non-result ("step", "2.1"). */
  tag: string;
  num: string;
  statement?: Slice;
  proofs: Slice[];
  /** With --context: each parent's statement, aids removed (their proofs are not needed). */
  context?: { node: GraphNode; statement?: Slice }[];
}

/** Everything `delta show <id> [--context]` prints, or undefined for an unknown id. */
export function showData(
  graph: ProofGraph,
  id: string,
  rel: Rel,
  withContext: boolean,
): ShowData | undefined {
  const node = graph.nodes.get(id);
  const el = node?.el ?? graph.byId.get(id);
  if (!el) return undefined;
  const ownerId = node ? undefined : graph.owners.get(id);
  const owner = ownerId !== undefined ? graph.nodes.get(ownerId) : undefined;
  const data: ShowData = {
    id,
    node,
    owner,
    tag: el.tag === "step-claim" ? "claim" : el.tag,
    num: el.attrs.num ?? "",
    // A proof nested in the result is listed with the proofs, not inside the statement.
    statement: sliceOf(graph, el, rel, node ? PROOF_TAGS : undefined),
    proofs: (node?.proofs ?? []).flatMap((p) => sliceOf(graph, p, rel) ?? []),
  };
  // The context of a result: its parents' statements. Of a step (or anything else inside a
  // proof): the result's own statement, hypotheses included, and its parents' statements.
  const base = node ?? owner;
  if (withContext && base) {
    const statement = (n: GraphNode) => ({
      node: n,
      statement: sliceOf(graph, n.el, rel, NOT_STATEMENT),
    });
    data.context = [
      ...(owner ? [statement(owner)] : []),
      ...base.parents.map((p) => statement(graph.nodes.get(p)!)),
    ];
  }
  return data;
}

const range = (s: Slice): string =>
  `${s.file}:${s.line}${s.endLine !== s.line ? `-${s.endLine}` : ""}`;

export function showText(d: ShowData): string {
  const out: string[] = [];
  if (d.node) out.push(`${label(d.node)} ${d.id}${title(d.node)} [${trust(d.node)}]`);
  else if (d.owner)
    out.push(
      `${d.tag}${d.num ? ` ${d.num}` : ""} ${d.id}, in ${label(d.owner)} ${d.owner.id} [${trust(d.owner)}]`,
    );
  else out.push(`${d.id} (not a result: no proof, no dependencies)`);
  if (d.statement)
    out.push(`── ${d.node ? "statement" : "source"} ${range(d.statement)}`, d.statement.source);
  for (const p of d.proofs) out.push(`── proof ${range(p)}`, p.source);
  if (d.node && d.node.tag !== "definition" && d.proofs.length === 0) out.push("── no proof yet");
  if (d.context) {
    out.push(
      d.context.length === 0
        ? "── context: uses no other result"
        : d.owner
          ? `── context: the result this is part of, and the statements its proof may use (${d.context.length})`
          : `── context: the statements this proof may use (${d.context.length})`,
    );
    for (const c of d.context) {
      out.push(
        `── ${label(c.node)} ${c.node.id}${title(c.node)} [${c.node.eff}]${c.statement ? ` ${range(c.statement)}` : ""}`,
      );
      if (c.statement) out.push(c.statement.source);
    }
  }
  return out.join("\n") + "\n";
}

export function showJson(d: ShowData, rel: Rel): unknown {
  return {
    ...(d.node
      ? nodeJson(d.node, rel)
      : { id: d.id, tag: d.tag, num: d.num, ...(d.owner ? { owner: d.owner.id } : {}) }),
    ...(d.statement ? { statement: d.statement } : {}),
    proofs: d.proofs,
    ...(d.context
      ? {
          context: d.context.map((c) => ({
            ...nodeJson(c.node, rel),
            ...(c.statement ? { statement: c.statement } : {}),
          })),
        }
      : {}),
  };
}

// -- uses ------------------------------------------------------------------

export function usesText(graph: ProofGraph, id: string, rel: Rel): string {
  const node = graph.nodes.get(id)!;
  const down = descendants(graph, id);
  if (down.length === 0) return `nothing uses ${id}\n`;
  const out = [
    `${down.length} result${down.length === 1 ? "" : "s"} downstream of ${label(node)} ${id}:`,
  ];
  for (const d of down) {
    const n = graph.nodes.get(d)!;
    const direct = node.children.includes(d) ? "direct" : "indirect";
    out.push(`  ${label(n)} ${n.id}${title(n)} [${trust(n)}] ${direct} ${where(n.loc, rel)}`);
  }
  return out.join("\n") + "\n";
}

export function usesJson(graph: ProofGraph, id: string, rel: Rel): unknown {
  const node = graph.nodes.get(id)!;
  return {
    id,
    direct: node.children,
    all: descendants(graph, id).map((d) => nodeJson(graph.nodes.get(d)!, rel)),
  };
}

// -- graph -----------------------------------------------------------------

export function graphText(graph: ProofGraph, rel: Rel): string {
  const out: string[] = [];
  for (const n of graph.nodes.values()) {
    const uses = n.parents.length ? ` ← ${n.parents.join(", ")}` : "";
    out.push(`${label(n)} ${n.id} [${trust(n)}]${uses} ${where(n.loc, rel)}`);
  }
  for (const c of graph.cycles) out.push(`cycle: ${c.join(" → ")}`);
  return out.join("\n") + "\n";
}

export function graphJson(graph: ProofGraph, rel: Rel): unknown {
  const nodes = [...graph.nodes.values()];
  return {
    nodes: nodes.map((n) => nodeJson(n, rel)),
    edges: nodes.flatMap((n) => n.parents.map((p) => ({ from: p, to: n.id }))),
    cycles: graph.cycles,
  };
}

export function frontierText(graph: ProofGraph, rel: Rel): string {
  const work = frontier(graph);
  if (work.length === 0)
    return "no work available: every result is verified or waits on an open ancestor\n";
  const out = [`${work.length} result${work.length === 1 ? "" : "s"} ready to work on:`];
  for (const n of work) {
    const state = n.proofs.length === 0 ? "needs a proof" : `proof is ${n.own}`;
    out.push(`  ${label(n)} ${n.id}${title(n)} ${state} ${where(n.loc, rel)}`);
  }
  return out.join("\n") + "\n";
}

export function frontierJson(graph: ProofGraph, rel: Rel): unknown {
  return { frontier: frontier(graph).map((n) => nodeJson(n, rel)) };
}

// -- lint --------------------------------------------------------------------

export function lintText(findings: Finding[]): string {
  if (findings.length === 0) return "no problems found\n";
  const lines = findings.map(
    (f) => `${f.severity}: ${f.message} (${f.file}${f.line !== undefined ? `:${f.line}` : ""})`,
  );
  const errors = findings.filter((f) => f.severity === "error").length;
  lines.push(
    `${errors} error${errors === 1 ? "" : "s"}, ${findings.length - errors} warning${findings.length - errors === 1 ? "" : "s"}`,
  );
  return lines.join("\n") + "\n";
}
