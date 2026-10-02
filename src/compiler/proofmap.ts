import { element as el, elements, titleOf, type ElementNode, type Node } from "./ast";
import { error, warn, type CompileContext } from "./context";
import { stringsFor } from "../language/strings";
import { TRUST } from "../language/trust";
import { ancestors, type GraphNode, type ProofGraph } from "./graph";

/**
 * `<proof-map of="thm:main"/>`: the results a theorem rests on, drawn as a layered graph
 * — what it uses above, the theorem at the bottom, each box coloured by effective trust.
 * Without `of`, the whole graph. Laid out here at compile time; the page gets finished
 * markup and the runtime adds nothing new:
 *
 *   <proof-map>
 *     <pm-canvas style="width…;height…">
 *       (raw) <svg> the edges </svg>
 *       <pm-node data-eff="sketch" style="left…;top…"><ref to="lem:a"/><pm-title>…</pm-title></pm-node>
 *     </pm-canvas>
 *     <pm-legend>…</pm-legend>
 *   </proof-map>
 *
 * Each box holds an ordinary `<ref>`, so the existing ref pass resolves it (across
 * chapters too) and the runtime gives it the usual preview card and jump. The title is a
 * copy of the result's `<title>`, so its math renders like any other. That is why this
 * pass runs first in the render phase, before math and refs.
 *
 * The layout is the classic layered one: layers by longest path to the bottom (so each
 * result sits just above what uses it), a dummy point wherever an edge crosses a layer, a
 * few barycenter sweeps to cut crossings, and each layer centred. Boxes have a fixed size
 * (nothing is measured at compile time), sized so four fit the text column; long titles
 * wrap to two lines and then ellipsize.
 */

const NODE_W = 132;
const NODE_H = 66;
const DUMMY_W = 10;
const GAP_X = 18;
const GAP_Y = 64;
const PAD = 12;
const SWEEPS = 8;

export function layoutProofMaps(doc: ElementNode, ctx: CompileContext, graph: ProofGraph | undefined): void {
  let n = 0; // per document, so the arrow marker ids are stable from build to build
  for (const el of [...elements(doc)]) {
    if (el.tag !== "proof-map" || !graph) continue;
    const of = el.attrs.of;
    if (of !== undefined && !graph.nodes.has(of)) {
      error(ctx, `<proof-map of="${of}">: no result with that id`, el.pos);
      continue;
    }
    const ids = of === undefined ? [...graph.nodes.keys()] : [...ancestors(graph, of).reverse(), of];
    if (ids.length === 0) {
      warn(ctx, "<proof-map>: the document has no results with an id to draw", el.pos);
      continue;
    }
    el.children = render(ids, graph, ctx, ++n);
  }
}

interface Slot {
  /** A result id, or a dummy point on a long edge. */
  id: string;
  dummy: boolean;
  layer: number;
  x: number;
  w: number;
}

/** Where everything goes: the slots of each layer, each edge as a chain of slots, the back edges. */
interface Layout {
  layers: Slot[][];
  /** Result id → its slot. */
  slots: Map<string, Slot>;
  /** Each forward edge as its chain of slots, parent first. */
  chains: Slot[][];
  /** Edges that close a cycle, drawn apart on the right. */
  back: [string, string][];
  width: number;
  height: number;
}

function render(ids: string[], graph: ProofGraph, ctx: CompileContext, n: number): Node[] {
  const layout = layOut(ids, graph);
  const t = stringsFor(ctx.lang);
  const svgWidth = layout.back.length ? layout.width + GAP_X * 2 : layout.width;
  const canvas = el("pm-canvas", { style: `width:${f(svgWidth)}px;height:${f(layout.height)}px` }, [
    { type: "raw", html: drawEdges(layout, svgWidth, n) },
    ...ids.map((id) => drawBox(graph.nodes.get(id)!, layout.slots.get(id)!, t)),
  ]);
  // Legend: only the statuses on this map, in trust order, in the document's language.
  const present = TRUST.filter((s) => ids.some((id) => graph.nodes.get(id)!.eff === s));
  const legend = el(
    "pm-legend",
    {},
    present.map((s) => el("pm-key", { "data-eff": s }, [{ type: "text", text: t[s] ?? s }])),
  );
  return [canvas, legend];
}

/** The layered layout: back edges out, layers, dummy slots, barycenter order, coordinates. */
function layOut(ids: string[], graph: ProofGraph): Layout {
  const inMap = new Set(ids);
  const parentsOf = (id: string) => graph.nodes.get(id)!.parents.filter((p) => inMap.has(p));
  const back = backEdges(ids, parentsOf);
  const isBack = (u: string, v: string) => back.some(([a, b]) => a === u && b === v);

  // Layers by longest path to the bottom: a result sits one row above its highest user,
  // so a lemma used only by the theorem stays next to it instead of floating to the top.
  const rise = new Map<string, number>();
  const heightOf = (id: string): number => {
    const known = rise.get(id);
    if (known !== undefined) return known;
    let h = 0;
    for (const c of graph.nodes.get(id)!.children) {
      if (inMap.has(c) && !isBack(id, c)) h = Math.max(h, heightOf(c) + 1);
    }
    rise.set(id, h);
    return h;
  };
  const tallest = Math.max(...ids.map(heightOf));
  const layer = new Map(ids.map((id) => [id, tallest - heightOf(id)]));

  // Slots per layer, with a dummy slot wherever an edge skips a layer.
  const layers: Slot[][] = [];
  const slot = (s: Slot) => ((layers[s.layer] ??= []).push(s), s);
  const slots = new Map<string, Slot>();
  for (const id of ids) slots.set(id, slot({ id, dummy: false, layer: layer.get(id)!, x: 0, w: NODE_W }));
  const chains: Slot[][] = [];
  for (const v of ids) {
    for (const u of parentsOf(v)) {
      if (isBack(u, v)) continue;
      const chain = [slots.get(u)!];
      for (let l = layer.get(u)! + 1; l < layer.get(v)!; l++) {
        chain.push(slot({ id: `${u}>${v}@${l}`, dummy: true, layer: l, x: 0, w: DUMMY_W }));
      }
      chain.push(slots.get(v)!);
      chains.push(chain);
    }
  }

  orderLayers(layers, chains, new Map(ids.map((id, i) => [id, i])));
  const width = placeLayers(layers);
  const height = PAD * 2 + layers.length * NODE_H + (layers.length - 1) * GAP_Y;
  return { layers, slots, chains, back, width, height };
}

/**
 * The edges that close a cycle: back edges of a depth-first walk up the parents. They
 * are left out of the layering and drawn apart, so the rest is a DAG.
 */
function backEdges(ids: string[], parentsOf: (id: string) => string[]): [string, string][] {
  const back: [string, string][] = [];
  const done = new Set<string>();
  const trail = new Set<string>();
  const visit = (id: string): void => {
    if (done.has(id)) return;
    trail.add(id);
    for (const p of parentsOf(id)) {
      if (trail.has(p)) back.push([p, id]);
      else visit(p);
    }
    trail.delete(id);
    done.add(id);
  };
  ids.forEach(visit);
  return back;
}

/** Order within each layer: document order, then barycenter sweeps down and up to cut crossings. */
function orderLayers(layers: Slot[][], chains: Slot[][], order: Map<string, number>): void {
  const up = new Map<Slot, Slot[]>();
  const down = new Map<Slot, Slot[]>();
  for (const c of chains) {
    for (let i = 0; i + 1 < c.length; i++) {
      (down.get(c[i]) ?? down.set(c[i], []).get(c[i])!).push(c[i + 1]);
      (up.get(c[i + 1]) ?? up.set(c[i + 1], []).get(c[i + 1])!).push(c[i]);
    }
  }
  for (const l of layers) l.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const pos = new Map<Slot, number>();
  layers.forEach((l) => l.forEach((s, i) => pos.set(s, i)));
  const sweep = (range: number[], near: Map<Slot, Slot[]>) => {
    for (const li of range) {
      const bary = (s: Slot) => {
        const ns = near.get(s) ?? [];
        return ns.length ? ns.reduce((a, n) => a + pos.get(n)!, 0) / ns.length : pos.get(s)!;
      };
      layers[li].sort((a, b) => bary(a) - bary(b));
      layers[li].forEach((s, i) => pos.set(s, i));
    }
  };
  const all = layers.map((_, i) => i);
  for (let k = 0; k < SWEEPS; k++) {
    sweep(all.slice(1), up);
    sweep(all.slice(0, -1).reverse(), down);
  }
}

/** Coordinates: each layer laid left to right, then centred on the widest one. Returns the width. */
function placeLayers(layers: Slot[][]): number {
  const widthOf = (l: Slot[]) => l.reduce((a, s) => a + s.w, 0) + GAP_X * (l.length - 1);
  const inner = Math.max(...layers.map(widthOf));
  for (const l of layers) {
    let x = PAD + (inner - widthOf(l)) / 2;
    for (const s of l) {
      s.x = x;
      x += s.w + GAP_X;
    }
  }
  return inner + 2 * PAD;
}

const f = (v: number) => Math.round(v * 10) / 10;
const top = (s: Slot) => PAD + s.layer * (NODE_H + GAP_Y);
const cx = (s: Slot) => s.x + s.w / 2;

/** The edges as one SVG: vertical-tangent curves through each dummy point, arrow at the user. */
function drawEdges(layout: Layout, svgWidth: number, n: number): string {
  const curve = (pts: [number, number][]) =>
    pts.reduce((d, [x, y], i) => {
      if (i === 0) return `M${f(x)} ${f(y)}`;
      const [px, py] = pts[i - 1];
      const my = f((py + y) / 2);
      return `${d} C${f(px)} ${my} ${f(x)} ${my} ${f(x)} ${f(y)}`;
    }, "");
  const paths = layout.chains.map((c) => {
    const pts: [number, number][] = [[cx(c[0]), top(c[0]) + NODE_H]];
    for (const s of c.slice(1, -1)) pts.push([cx(s), top(s)], [cx(s), top(s) + NODE_H]);
    pts.push([cx(c[c.length - 1]), top(c[c.length - 1]) - 2]);
    return `<path d="${curve(pts)}" marker-end="url(#pm-arrow-${n})"/>`;
  });
  for (const [u, v] of layout.back) {
    const a = layout.slots.get(u)!;
    const b = layout.slots.get(v)!;
    const side = Math.max(a.x + a.w, b.x + b.w) + GAP_X;
    paths.push(
      `<path class="pm-back" d="M${f(a.x + a.w)} ${f(top(a) + NODE_H / 2)} C${f(side)} ${f(top(a) + NODE_H / 2)} ${f(side)} ${f(top(b) + NODE_H / 2)} ${f(b.x + b.w + 2)} ${f(top(b) + NODE_H / 2)}" marker-end="url(#pm-arrow-${n})"/>`,
    );
  }
  const h = f(layout.height);
  return (
    `<svg class="pm-edges" width="${f(svgWidth)}" height="${h}" viewBox="0 0 ${f(svgWidth)} ${h}" aria-hidden="true">` +
    `<defs><marker id="pm-arrow-${n}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">` +
    `<path d="M0 0L8 4L0 8z"/></marker></defs>${paths.join("")}</svg>`
  );
}

/** One box: a ref (label + preview + jump) and the result's own title, coloured by trust. */
function drawBox(node: GraphNode, s: Slot, t: Record<string, string>): ElementNode {
  const title = titleOf(node.el);
  const kids: Node[] = [el("ref", { to: node.id })];
  if (title) kids.push(el("pm-title", {}, title.children.map(stripIds)));
  return el(
    "pm-node",
    {
      "data-eff": node.eff,
      ...(node.own !== node.eff ? { "data-own": node.own } : {}),
      // Hover text: own → effective trust, in the document's language.
      title:
        (node.stale ? `${t.stale} · ` : "") +
        (node.own === node.eff ? (t[node.eff] ?? node.eff) : `${t[node.own] ?? node.own} → ${t[node.eff] ?? node.eff}`),
      ...(node.cyclic ? { "data-cyclic": "true" } : {}),
      ...(node.stale ? { "data-stale": "true" } : {}),
      style: `left:${f(s.x)}px;top:${f(top(s))}px;width:${NODE_W}px;height:${NODE_H}px`,
    },
    kids,
  );
}

/** A deep copy with every `id` dropped, so a copied title never duplicates an anchor. */
function stripIds(n: Node): Node {
  if (n.type !== "element") return { ...n };
  const { id: _id, ...attrs } = n.attrs;
  return { ...n, attrs, children: n.children.map(stripIds), src: undefined };
}
