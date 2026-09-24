import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileProject } from "../src/compiler/project";
import { lintFindings, showData, showText } from "../src/graph-report";

function build(src: string) {
  const dir = mkdtempSync(join(tmpdir(), "delta-struct-"));
  writeFileSync(join(dir, "p.dlt"), src);
  const r = compileProject({ inputs: [join(dir, "p.dlt")], outDir: dir });
  return { ...r, html: r.outputs[0]?.html ?? "", graph: r.graph! };
}

const doc = (body: string) => `<document lang="pt-BR"><section id="s"><title>S</title>${body}</section></document>`;

const PROOF = doc(`
  <lemma id="lem:a">A.</lemma>
  <claim id="cl:plain">An ordinary claim, numbered as always.</claim>
  <theorem id="thm:t">Suponha <hyp id="h:1">$x > 0$</hyp> e <hyp id="h:2">$x$ inteiro</hyp>. Então $x \\ge 1$.</theorem>
  <proof of="thm:t">
    <step id="st:1"><claim>$x \\ne 0$.</claim><proof>Por <ref to="h:1"/>.</proof></step>
    <step>
      <claim>$x \\ge 1$.</claim>
      <proof>
        <step><claim>$|x| \\ge 1$.</claim><proof>Por <ref to="st:1"/>, <ref to="h:2"/> e <ref to="lem:a"/>.</proof></step>
      </proof>
    </step>
  </proof>
  <counterexample breaks="h:2">$x = 1/2$.</counterexample>`);

describe("structured proofs", () => {
  it("number steps by their place (ids for those without), and fold each step's proof", () => {
    const { html, diagnostics } = build(PROOF);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(html).toContain('<delta-step id="st:1" num="1" depth="1">');
    expect(html).toContain('<delta-step num="2" depth="1" id="thm:t-step-2">');
    expect(html).toContain('<delta-step num="2.1" depth="2" id="thm:t-step-2.1">');
    expect(html).toMatch(/<delta-proof collapsible="true" collapsed="true" data-depth="2">/);
    expect(html).toMatch(/<delta-proof of="thm:t" data-step-depth="2"/);
  });

  it("keep a step's <claim> out of the numbered claim environment", () => {
    const { html } = build(PROOF);
    expect(html).toContain('<delta-claim id="cl:plain" num="1.1">'); // the only numbered claim
    expect(html).toContain("<delta-step-claim>");
    expect(html).not.toMatch(/<delta-claim num=/);
  });

  it("count refs inside steps as edges of the result, but not refs to its own steps or hypotheses", () => {
    const { graph } = build(PROOF);
    expect(graph.nodes.get("thm:t")!.parents).toEqual(["lem:a"]);
  });

  it("make steps addressable by delta show, with the result as context", () => {
    const { graph } = build(PROOF);
    const text = showText(showData(graph, "thm:t-step-2.1", basename, true)!);
    expect(text).toMatch(/^step 2\.1 thm:t-step-2\.1, in theorem 1\.1 thm:t/);
    expect(text).toContain('<hyp id="h:2">$x$ inteiro</hyp>'); // the owner's statement
    expect(text).toContain('<lemma id="lem:a">A.</lemma>'); // what the proof uses
  });

  it("reject misplaced pieces", () => {
    const { diagnostics } = build(doc(`<step><claim>x</claim></step><lemma id="l">L.</lemma><proof of="l"><hyp id="h">no</hyp><step><proof>p</proof></step></proof>`));
    const errors = diagnostics.filter((d) => d.severity === "error").map((d) => d.message);
    expect(errors).toEqual([
      "<step> must be directly inside a <proof> (a step's own <proof> included); found inside <section>",
      "step 1 has no <claim>: say what the step establishes",
      "<hyp> must be in the statement of a result (theorem, lemma, …), not in a proof or an aid",
    ]);
  });
});

describe("hypotheses", () => {
  it("are labelled H1, H2 per result and read (H1) when referenced", () => {
    const { html } = build(PROOF);
    expect(html).toContain('<delta-hyp id="h:1" num="H1">');
    expect(html).toContain('<delta-hyp id="h:2" num="H2">');
    expect(html).toMatch(/<delta-ref to="h:1" data-target-num="H1" data-target-tag="hyp">/);
  });

  it("carry, for their preview, where the proof uses them and why they are needed", () => {
    const { html } = build(PROOF);
    const uses = (id: string) => html.match(new RegExp(`<delta-hyp id="${id}"[^]*?(<delta-hyp-uses>[^]*?</delta-hyp-uses>)`))![1];
    expect(uses("h:1")).toMatch(/<delta-hyp-used><delta-ref to="st:1"/);
    expect(uses("h:2")).toMatch(/<delta-hyp-used><delta-ref to="thm:t-step-2\.1"/);
    expect(uses("h:2")).toMatch(/<delta-hyp-needed><delta-ref to="h:2-counterexample-1" data-target-num="1\.1" data-target-tag="counterexample">/);
  });

  it("are flagged by lint when the proof never uses them; so are bad counterexamples and unproved steps", () => {
    const { graph, diagnostics } = build(
      doc(`<theorem id="t">If <hyp id="h:a">a</hyp> and <hyp id="h:b">b</hyp>.</theorem>
        <proof of="t"><step><claim>c</claim></step> by <ref to="h:a"/>.</proof>
        <counterexample breaks="nope">x</counterexample>`),
    );
    const kinds = lintFindings(graph, diagnostics, basename).map((f) => [f.kind, f.ids?.[0]]);
    expect(kinds).toContainEqual(["unused-hypothesis", "h:b"]);
    expect(kinds).toContainEqual(["bad-counterexample", "nope"]);
    expect(kinds).toContainEqual(["unproved-step", "t-step-1"]);
    expect(kinds).not.toContainEqual(["unused-hypothesis", "h:a"]);
  });
});
