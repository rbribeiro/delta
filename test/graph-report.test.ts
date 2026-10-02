import { basename } from "node:path";
import { describe, expect, it } from "vitest";
import { AID_TAGS } from "../src/language/tags";
import {
  frontierText,
  lintFindings,
  lintText,
  outlineJson,
  outlineText,
  showData,
  showText,
  sliceOf,
  usesText,
} from "../src/graph-report";
import { compileFiles } from "./helpers";

const rel = (f: string) => basename(f);

function build(src: string) {
  const r = compileFiles({ "p.dlt": src });
  return { graph: r.graph!, diagnostics: r.diagnostics };
}

const SRC = `<document>
  <section id="s"><title>S</title>
    <lemma id="a">
      <title>Base</title>
      If $x < y$ and $y < z$ then $x < z$.
      <intuition>Order is transitive.</intuition>
      <strategy>Nothing to it.</strategy>
    </lemma>
    <proof of="a" status="verified">Immediate.</proof>
    <theorem id="t">T, by <ref to="a"/>.</theorem>
    <proof of="t" status="sketch">Apply <ref to="a"/> twice.</proof>
    <lemma id="o" status="open">Planned, from <ref to="t"/>.</lemma>
  </section>
</document>
`;

describe("sliceOf", () => {
  it("returns the exact source, dedented, with its line range", () => {
    const { graph } = build(SRC);
    const s = sliceOf(graph, graph.nodes.get("a")!.el, rel)!;
    expect(s).toMatchObject({ file: "p.dlt", line: 3, endLine: 8 });
    expect(s.source).toBe(`<lemma id="a">
  <title>Base</title>
  If $x < y$ and $y < z$ then $x < z$.
  <intuition>Order is transitive.</intuition>
  <strategy>Nothing to it.</strategy>
</lemma>`);
  });

  it("cuts the narrative aids out of a statement, lines and all", () => {
    const { graph } = build(SRC);
    const s = sliceOf(graph, graph.nodes.get("a")!.el, rel, AID_TAGS)!;
    expect(s.source).toBe(`<lemma id="a">
  <title>Base</title>
  If $x < y$ and $y < z$ then $x < z$.
</lemma>`);
  });
});

describe("show", () => {
  it("prints the node, its proof, and with --context only its parents' statements", () => {
    const { graph } = build(SRC);
    const text = showText(showData(graph, "t", rel, true)!);
    expect(text).toContain("theorem 1.1 t [sketch]");
    expect(text).toContain(`── proof p.dlt:11\n<proof of="t" status="sketch">Apply <ref to="a"/> twice.</proof>`);
    expect(text).toContain("── context: the statements this proof may use (1)");
    expect(text).toContain("If $x < y$ and $y < z$ then $x < z$.");
    expect(text).not.toContain("Immediate."); // the parent's proof is not context
    expect(text).not.toContain("Order is transitive."); // nor its aids
  });

  it("says when a result has no proof yet, and shows non-results by source", () => {
    const { graph } = build(SRC);
    expect(showText(showData(graph, "o", rel, false)!)).toContain("── no proof yet");
    expect(showText(showData(graph, "s", rel, false)!)).toContain("s (not a result");
    expect(showData(graph, "nope", rel, false)).toBeUndefined();
  });
});

describe("outline, uses, frontier", () => {
  it("lists sections and results with own → effective status and file:line", () => {
    const { graph } = build(SRC);
    expect(outlineText(graph, rel)).toBe(`p.dlt
  1 S p.dlt:2
    lemma 1.1 a (Base) [verified] p.dlt:3
    theorem 1.1 t [sketch] p.dlt:10
    lemma 1.2 o [open] p.dlt:12
`);
    expect(outlineJson(graph, rel)).toMatchObject({
      files: [{ file: "p.dlt", entries: [{ tag: "section", id: "s", children: [{ id: "a", own: "verified", eff: "verified", line: 3 }, { id: "t" }, { id: "o" }] }] }],
    });
  });

  it("lists what is downstream and what is ready to work on", () => {
    const { graph } = build(SRC);
    expect(usesText(graph, "a", rel)).toContain("theorem 1.1 t [sketch] direct p.dlt:10");
    expect(usesText(graph, "a", rel)).toContain("lemma 1.2 o [open] indirect p.dlt:12");
    expect(frontierText(graph, rel)).toBe(`2 results ready to work on:
  theorem 1.1 t proof is sketch p.dlt:10
  lemma 1.2 o needs a proof p.dlt:12
`);
  });
});

describe("lint", () => {
  it("reports a clean graph as clean, except a verification marked by hand", () => {
    const { graph, diagnostics } = build(SRC);
    const findings = lintFindings(graph, diagnostics, rel);
    expect(findings.map((f) => [f.severity, f.kind, f.ids])).toEqual([["warning", "unpinned", ["a"]]]);
    expect(lintText(findings.filter((f) => f.kind !== "unpinned"))).toBe("no problems found\n");
  });

  it("reports cycles, dangling refs, overclaims, misplaced aids and stray proofs, without duplicates", () => {
    const { graph, diagnostics } = build(`<document><section id="s"><title>S</title>
<lemma id="a">A.</lemma><proof of="a" status="verified">By <ref to="b"/>.</proof>
<lemma id="b">B.</lemma><proof of="b" status="sketch">By <ref to="a"/> and <ref to="nope"/>.</proof>
<obstacle>loose</obstacle>
<proof of="ghost">p</proof>
</section></document>`);
    const findings = lintFindings(graph, diagnostics, rel);
    expect(findings.map((f) => [f.severity, f.kind, f.line])).toEqual([
      ["error", "cycle", 2],
      ["error", "dangling-ref", 3],
      ["error", "overclaimed", 2],
      ["warning", "unpinned", 2],
      ["warning", "stray-proof", 5],
      ["error", "compile", 4],
    ]);
    expect(findings[0].message).toBe("circular reasoning: a → b → a");
    expect(findings.filter((f) => f.message.includes("nope"))).toHaveLength(1);
  });
});
