import type { ElementNode } from "./compiler/ast";
import type { Diagnostic } from "./compiler/context";
import {
  descendants,
  frontier,
  overclaimed,
  type GraphNode,
  type Loc,
  type OutlineEntry,
  type ProofGraph,
} from "./compiler/graph";
import { AID_TAGS } from "./compiler/understanding";

/**
 * The agent-facing views of the proof graph: `delta outline`, `show`, `uses`, `graph` and
 * `lint`, each as text or JSON. Pure functions (no I/O) over the graph the compiler built,
 * so the CLI is a thin shell and tests need no process. Paths go through `rel`, so the CLI
 * prints them relative to where the agent stands.
 */

export type Rel = (file: string) => string;

const where = (loc: Loc, rel: Rel): string => `${rel(loc.file)}:${loc.line}`;
const label = (n: GraphNode): string => `${n.tag}${n.num ? ` ${n.num}` : ""}`;
const title = (n: { title: string }): string => (n.title ? ` (${n.title})` : "");
/** `sketch` when own = eff, `sketch → open` when an ancestor pulls it down. */
const trust = (n: GraphNode): string => (n.own === n.eff ? n.eff : `${n.own} → ${n.eff}`) + (n.cyclic ? ", cyclic" : "");

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
        out.push(`${pad}${label(node)} ${node.id}${title(node)} [${trust(node)}] ${where(node.loc, rel)}`);
      } else {
        out.push(`${pad}${e.num ? `${e.num} ` : ""}${e.title || `<${e.tag}>`} ${where(e.loc, rel)}`);
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
    const base = { tag: e.tag, ...(e.id !== undefined ? { id: e.id } : {}), num: e.num, title: e.title, file: rel(e.loc.file), line: e.loc.line };
    if (node && node.el.tag === e.tag) return { ...base, own: node.own, eff: node.eff };
    return { ...base, children: e.children.map(entry) };
  };
  return { files: graph.outline.map((f) => ({ file: rel(f.file), entries: f.entries.map(entry) })) };
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
export function sliceOf(graph: ProofGraph, el: ElementNode, rel: Rel, drop?: Set<string>): Slice | undefined {
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
  const lineStart = text.lastIndexOf("\n", span.start - 1) + 1;
  const indent = /^[ \t]*/.exec(text.slice(lineStart, span.start))![0].length;
  const source = body
    .split("\n")
    .map((l, i) => (i === 0 ? l : l.replace(new RegExp(`^[ \\t]{0,${indent}}`), "")))
    .join("\n");

  const lineOf = (offset: number): number => text.slice(0, offset).split("\n").length;
  return { file: rel(span.file), line: lineOf(span.start), endLine: lineOf(span.end), source };
}

export interface ShowData {
  id: string;
  node?: GraphNode;
  statement?: Slice;
  proofs: Slice[];
  /** With --context: each parent's statement, aids removed (their proofs are not needed). */
  context?: { node: GraphNode; statement?: Slice }[];
}

/** Everything `delta show <id> [--context]` prints, or undefined for an unknown id. */
export function showData(graph: ProofGraph, id: string, rel: Rel, withContext: boolean): ShowData | undefined {
  const node = graph.nodes.get(id);
  const el = node?.el ?? graph.byId.get(id);
  if (!el) return undefined;
  const data: ShowData = {
    id,
    node,
    statement: sliceOf(graph, el, rel),
    proofs: (node?.proofs ?? []).flatMap((p) => sliceOf(graph, p, rel) ?? []),
  };
  if (withContext && node) {
    data.context = node.parents.map((p) => {
      const parent = graph.nodes.get(p)!;
      return { node: parent, statement: sliceOf(graph, parent.el, rel, AID_TAGS) };
    });
  }
  return data;
}

const range = (s: Slice): string => `${s.file}:${s.line}${s.endLine !== s.line ? `-${s.endLine}` : ""}`;

export function showText(d: ShowData): string {
  const out: string[] = [];
  if (d.node) out.push(`${label(d.node)} ${d.id}${title(d.node)} [${trust(d.node)}]`);
  else out.push(`${d.id} (not a result: no proof, no dependencies)`);
  if (d.statement) out.push(`── ${d.node ? "statement" : "source"} ${range(d.statement)}`, d.statement.source);
  for (const p of d.proofs) out.push(`── proof ${range(p)}`, p.source);
  if (d.node && d.node.tag !== "definition" && d.proofs.length === 0) out.push("── no proof yet");
  if (d.context) {
    out.push(
      d.context.length === 0
        ? "── context: uses no other result"
        : `── context: the statements this proof may use (${d.context.length})`,
    );
    for (const c of d.context) {
      out.push(`── ${label(c.node)} ${c.node.id}${title(c.node)} [${c.node.eff}]${c.statement ? ` ${range(c.statement)}` : ""}`);
      if (c.statement) out.push(c.statement.source);
    }
  }
  return out.join("\n") + "\n";
}

export function showJson(d: ShowData, rel: Rel): unknown {
  return {
    ...(d.node ? nodeJson(d.node, rel) : { id: d.id }),
    ...(d.statement ? { statement: d.statement } : {}),
    proofs: d.proofs,
    ...(d.context
      ? { context: d.context.map((c) => ({ ...nodeJson(c.node, rel), ...(c.statement ? { statement: c.statement } : {}) })) }
      : {}),
  };
}

// -- uses ------------------------------------------------------------------

export function usesText(graph: ProofGraph, id: string, rel: Rel): string {
  const node = graph.nodes.get(id)!;
  const down = descendants(graph, id);
  if (down.length === 0) return `nothing uses ${id}\n`;
  const out = [`${down.length} result${down.length === 1 ? "" : "s"} downstream of ${label(node)} ${id}:`];
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
  if (work.length === 0) return "no work available: every result is verified or waits on an open ancestor\n";
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
    out.push({ severity: "error", kind: "cycle", message: `circular reasoning: ${cycle.join(" → ")}`, ...at(first.loc), ids: cycle });
  }
  for (const d of graph.dangling) {
    out.push({ severity: "error", kind: "dangling-ref", message: `ref to "${d.to}", which no element defines`, ...at(d.loc), ids: [d.to] });
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
  for (const s of graph.strayProofs) {
    out.push({ severity: "warning", kind: "stray-proof", message: `<proof of="${s.of}"> does not prove a result in the graph`, ...at(s.loc), ids: [s.of] });
  }
  for (const n of graph.nodes.values()) {
    if (n.proofs.length > 1) {
      out.push({ severity: "warning", kind: "several-proofs", message: `${n.id} has ${n.proofs.length} proofs; the first sets its status`, ...at(n.loc), ids: [n.id] });
    }
    if (n.el.attrs.status === "open" && n.proofs.length > 0) {
      out.push({ severity: "warning", kind: "open-with-proof", message: `${n.id} is status="open" but has a proof; drop the status`, ...at(n.loc), ids: [n.id] });
    }
  }
  for (const d of diagnostics) {
    if (d.message.startsWith("Unresolved reference")) continue;
    out.push({ severity: d.severity, kind: "compile", message: d.message, file: rel(d.file), ...(d.pos ? { line: d.pos.line } : {}) });
  }
  return out;
}

export function lintText(findings: Finding[]): string {
  if (findings.length === 0) return "no problems found\n";
  const lines = findings.map((f) => `${f.severity}: ${f.message} (${f.file}${f.line !== undefined ? `:${f.line}` : ""})`);
  const errors = findings.filter((f) => f.severity === "error").length;
  lines.push(`${errors} error${errors === 1 ? "" : "s"}, ${findings.length - errors} warning${findings.length - errors === 1 ? "" : "s"}`);
  return lines.join("\n") + "\n";
}
