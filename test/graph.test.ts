import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ancestors, descendants, type ProofGraph } from "../src/compiler/graph";
import { frontier, overclaimed } from "../src/graph-report";
import { compileProject, type ProjectResult } from "../src/compiler/project";

/** Writes the files into a fresh dir and compiles the `.dlt` ones (in order) as one project. */
function project(files: Record<string, string>): ProjectResult & { graph: ProofGraph; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "delta-graph-"));
  for (const [name, src] of Object.entries(files)) writeFileSync(join(dir, name), src);
  const inputs = Object.keys(files).filter((n) => n.endsWith(".dlt") && !n.startsWith("_")).map((n) => join(dir, n));
  const r = compileProject({ inputs, outDir: dir });
  if (!r.graph) throw new Error("no graph: " + JSON.stringify(r.diagnostics));
  return { ...r, graph: r.graph, dir };
}

const one = (body: string) => project({ "a.dlt": `<document><section id="s"><title>S</title>${body}</section></document>` });
const parents = (g: ProofGraph, id: string) => g.nodes.get(id)!.parents;

describe("edges", () => {
  it("come from refs in the statement and in the proof, <ref> and math \\ref alike", () => {
    const { graph } = one(`
      <definition id="d">D.</definition>
      <lemma id="a">Uses <ref to="d"/>.</lemma>
      <lemma id="b">B.</lemma>
      <theorem id="t">T.</theorem>
      <proof of="t">By $\\ref{a}$ and <ref to="b"/>.</proof>`);
    expect(parents(graph, "a")).toEqual(["d"]);
    expect(parents(graph, "t")).toEqual(["a", "b"]);
    expect(graph.nodes.get("d")!.children).toEqual(["a"]);
  });

  it("map a ref to an equation or figure to the result that contains it", () => {
    const { graph } = one(`
      <lemma id="a">$$x$$<equation id="eq:a">x = 1</equation></lemma>
      <lemma id="b">Q.</lemma>
      <proof of="b">By \\eqref{eq:a} and <ref to="eq:in-proof"/>.</proof>
      <lemma id="c">C.</lemma>
      <proof of="c"><equation id="eq:in-proof">y</equation></proof>`);
    expect(parents(graph, "b")).toEqual(["a", "c"]);
  });

  it("ignore narrative refs (aids), comments, and refs to sections", () => {
    const { graph } = one(`
      <lemma id="a">A.</lemma>
      <theorem id="t">T, see <ref to="s"/>.
        <intuition><ref to="a"/></intuition><strategy><ref to="a"/></strategy>
        <obstacle><ref to="a"/></obstacle>
      </theorem>
      <proof of="t">Done.<comment by="x">see <ref to="a"/></comment></proof>`);
    expect(parents(graph, "t")).toEqual([]);
  });

  it("cross files in a project", () => {
    const { graph } = project({
      "a.dlt": `<document><section id="sa"><title>A</title><lemma id="a">A.</lemma></section></document>`,
      "b.dlt": `<document><section id="sb"><title>B</title><theorem id="t">By <ref to="a"/>.</theorem></section></document>`,
    });
    expect(parents(graph, "t")).toEqual(["a"]);
    expect(graph.nodes.get("a")!.loc.file).toMatch(/a\.dlt$/);
    expect(graph.nodes.get("t")!.loc.file).toMatch(/b\.dlt$/);
  });
});

describe("trust", () => {
  it("reads a node's own trust off its proof", () => {
    const { graph } = one(`
      <definition id="d">D.</definition>
      <lemma id="none">no proof</lemma>
      <lemma id="bare">x</lemma><proof of="bare">p</proof>
      <lemma id="dr">x</lemma><proof of="dr" status="draft">p</proof>
      <lemma id="rv">x</lemma><proof of="rv" status="review">p</proof>
      <lemma id="h">x</lemma><proof of="h" status="heuristic">p</proof>
      <lemma id="v">x</lemma><proof of="v" status="verified">p</proof>
      <lemma id="f">x</lemma><proof of="f" status="formalized">p</proof>`);
    const own = Object.fromEntries([...graph.nodes.values()].map((n) => [n.id, n.own]));
    expect(own).toEqual({
      d: "verified", none: "open", bare: "sketch", dr: "heuristic", rv: "sketch", h: "heuristic", v: "verified", f: "formalized",
    });
  });

  it("propagates the weakest ancestor down the graph", () => {
    const { graph } = one(`
      <lemma id="a">A.</lemma><proof of="a" status="sketch">p</proof>
      <lemma id="b">B.</lemma><proof of="b" status="verified">By <ref to="a"/>.</proof>
      <theorem id="t">T.</theorem><proof of="t" status="formalized">By <ref to="b"/>.</proof>`);
    expect(graph.nodes.get("b")!.eff).toBe("sketch");
    expect(graph.nodes.get("t")!.eff).toBe("sketch");
    expect(overclaimed(graph).map((o) => [o.node.id, o.blame])).toEqual([
      ["b", ["a"]],
      ["t", ["a"]],
    ]);
  });

  it("reports a cycle with its path, and treats its members as open", () => {
    const { graph } = one(`
      <lemma id="a">A.</lemma><proof of="a" status="verified">By <ref to="b"/>.</proof>
      <lemma id="b">B.</lemma><proof of="b" status="verified">By <ref to="c"/>.</proof>
      <lemma id="c">C.</lemma><proof of="c" status="verified">By <ref to="a"/>.</proof>
      <theorem id="t">T.</theorem><proof of="t" status="verified">By <ref to="a"/>.</proof>`);
    expect(graph.cycles).toHaveLength(1);
    const cycle = graph.cycles[0];
    expect(cycle[0]).toBe(cycle[cycle.length - 1]);
    expect(new Set(cycle)).toEqual(new Set(["a", "b", "c"]));
    expect(["a", "b", "c", "t"].map((id) => graph.nodes.get(id)!.eff)).toEqual(["open", "open", "open", "open"]);
  });

  it("offers as work the unproved and sketched results whose parents are at least sketched", () => {
    const { graph } = one(`
      <lemma id="a">A.</lemma><proof of="a" status="verified">p</proof>
      <lemma id="b" status="open">B.</lemma>
      <lemma id="c">C, from <ref to="b"/>.</lemma>
      <lemma id="d">D.</lemma><proof of="d" status="sketch">By <ref to="a"/>.</proof>
      <theorem id="t">T.</theorem><proof of="t" status="sketch">By <ref to="c"/> and <ref to="d"/>.</proof>`);
    expect(frontier(graph).map((n) => n.id)).toEqual(["b", "d"]);
    expect(ancestors(graph, "t")).toEqual(["c", "d", "b", "a"]);
    expect(descendants(graph, "b")).toEqual(["c", "t"]);
  });
});

describe("problems the graph records", () => {
  it("finds dangling refs anywhere, narrative ones included, and proofs of nothing", () => {
    const { graph } = one(`
      <lemma id="a">A <ref to="x1"/>.<intuition>$\\ref{x2}$</intuition></lemma>
      Text <ref to="x3"/>.
      <proof of="ghost">p</proof>`);
    expect(graph.dangling.map((d) => d.to)).toEqual(["x1", "x2", "x3"]);
    expect(graph.strayProofs.map((s) => s.of)).toEqual(["ghost"]);
  });
});

describe("source locations", () => {
  it("keep an included file's own name, in the graph and in diagnostics", () => {
    const r = project({
      "main.dlt": `<document><section id="s"><title>S</title>\n<include src="_part.dlt"/>\n</section></document>`,
      "_part.dlt": `<document>\n\n  <lemma id="p">Part.</lemma>\n  <strategy>misplaced</strategy>\n</document>`,
    });
    expect(r.graph.nodes.get("p")!.loc).toEqual({ file: join(r.dir, "_part.dlt"), line: 3 });
    const err = r.diagnostics.find((d) => d.message.startsWith("<strategy>"))!;
    expect(err.file).toBe(join(r.dir, "_part.dlt"));
    expect(err.pos?.line).toBe(4);
  });
});
