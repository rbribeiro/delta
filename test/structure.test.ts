import { basename } from "node:path";
import { describe, expect, it } from "./harness.ts";
import { lintFindings, showData, showText } from "../src/graph-report.ts";
import { compileFiles } from "./helpers.ts";

function build(src: string) {
  const r = compileFiles({ "p.dlt": src });
  return { ...r, html: r.html("p.html"), graph: r.graph! };
}

const doc = (body: string) =>
  `<document lang="pt-BR"><section id="s"><title>S</title>${body}</section></document>`;

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
  it("number steps by their place (ids for those without), and fold each top-level step's proof", () => {
    const { html, diagnostics } = build(PROOF);
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(html).toContain('<delta-step id="st:1" num="1" depth="1">');
    expect(html).toContain('<delta-step num="2" depth="1" id="thm:t-step-2">');
    expect(html).toContain('<delta-step num="2.1" depth="2" id="thm:t-step-2.1">');
    expect(html).toMatch(
      /<delta-step id="st:1"[^>]*>.*?<delta-proof collapsible="true" collapsed="true">/s,
    );
    // a sub-step's proof reads inside its step: it never folds
    expect(html).toMatch(/<delta-step num="2\.1"[^>]*>.*?<delta-proof>/s);
    expect(html).toMatch(
      /<delta-proof of="thm:t" data-attached="true" collapsed="true" data-step-depth="2"/,
    );
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

  it("number a solution's steps after its exercise", () => {
    const { html, diagnostics } = build(
      doc(
        `<exercise id="ex">E.</exercise><solution><step><claim>a</claim><proof>p</proof></step></solution>`,
      ),
    );
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(html).toContain('<delta-step num="1" depth="1" id="ex-step-1">');
    expect(html).toMatch(/<delta-solution [^>]*data-step-depth="1"/);
  });

  it("reject misplaced pieces", () => {
    const { diagnostics } = build(
      doc(
        `<step><claim>x</claim></step><lemma id="l">L.</lemma><proof of="l"><hyp id="h">no</hyp><step><proof>p</proof></step></proof>`,
      ),
    );
    const errors = diagnostics.filter((d) => d.severity === "error").map((d) => d.message);
    expect(errors).toEqual([
      "<step> must be directly inside a <proof> or <solution> (a step's own <proof> included); found inside <section>",
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
    const uses = (id: string) =>
      html.match(
        new RegExp(`<delta-hyp id="${id}"[^]*?(<delta-hyp-uses>[^]*?</delta-hyp-uses>)`),
      )![1];
    expect(uses("h:1")).toMatch(/<delta-hyp-used><delta-ref to="st:1"/);
    expect(uses("h:2")).toMatch(/<delta-hyp-used><delta-ref to="thm:t-step-2\.1"/);
    expect(uses("h:2")).toMatch(
      /<delta-hyp-needed><delta-ref to="h:2-counterexample-1" data-target-num="1\.1" data-target-tag="counterexample">/,
    );
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

describe("collaboration wrappers", () => {
  it("numbers a step inserted with <change>, and finds a claim changed with <change>", () => {
    const { diagnostics, html } = build(
      doc(`<lemma id="l">x</lemma>
      <proof of="l">
        <step><claim>a</claim></step>
        <change by="ai"><new><step><claim>b</claim></step></new></change>
        <draft><step><change><old><claim>c0</claim></old><new><claim>c</claim></new></change></step></draft>
      </proof>`),
    );
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(html).toContain('<delta-step num="2" depth="1" id="l-step-2">');
    expect(html).toContain('<delta-step num="3" depth="1" id="l-step-3">');
  });

  it("numbers nothing inside <old> or a comment, so review and final agree", () => {
    const { diagnostics, html } = build(
      doc(`<theorem id="t">Assume
      <change by="a"><old><hyp id="h0">x</hyp></old><new><hyp id="h1">y</hyp></new></change>
      <comment by="a"><hyp id="hc">z</hyp></comment> and <hyp id="h2">w</hyp>.</theorem>
      <proof of="t"><change by="a"><old><step><claim>gone</claim></step></old></change>By <ref to="h2"/>.</proof>`),
    );
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    expect(html).toMatch(/<delta-hyp id="h1" num="H1"/);
    expect(html).toMatch(/<delta-hyp id="h2" num="H2"/);
    expect(html).not.toMatch(/<delta-step num=/);
  });
});

describe("several proofs of one result", () => {
  it("gives the second proof's steps their own ids", () => {
    const { diagnostics, html } = build(
      doc(`<lemma id="t">x</lemma>
      <proof of="t"><step><claim>a</claim></step></proof>
      <proof of="t"><step><claim>b</claim></step></proof>`),
    );
    expect(diagnostics).toEqual([]);
    expect(html).toContain('id="t-step-1"');
    expect(html).toContain('id="t-proof2-step-1"');
  });

  it("counts across the files of a project, and so do counterexample ids", () => {
    const r = compileFiles({
      "a.dlt": doc(`<theorem id="t">If <hyp id="h">p</hyp>.</theorem>
      <proof of="t"><step><claim>a</claim></step></proof><counterexample breaks="h">one</counterexample>`),
      "b.dlt": `<document><section id="s2"><title>S2</title>
      <proof of="t"><step><claim>b</claim></step></proof><counterexample breaks="h">two</counterexample></section></document>`,
    });
    expect(r.diagnostics).toEqual([]);
    expect(r.outputs[1].html).toContain('id="t-proof2-step-1"');
    expect(r.outputs[1].html).toContain('id="h-counterexample-2"');
  });
});

describe("a proof without `of`", () => {
  it('proves the result right before it, and still reads plain "Proof."', () => {
    const { graph, html } = build(
      doc(`<lemma id="a">A.</lemma>
      <theorem id="t">T.</theorem>
      <comment by="x">later</comment>
      <proof>By <ref to="a"/>.<step><claim>c</claim></step></proof>`),
    );
    expect(graph.nodes.get("t")!.parents).toEqual(["a"]);
    expect(graph.nodes.get("t")!.own).toBe("sketch");
    expect(html).toContain('<delta-proof data-of="t"');
    expect(html).not.toMatch(/<delta-proof [^>]*\sof=/);
    expect(html).toContain('id="t-step-1"');
  });

  it("links through a <change>, and a second proof right after the first", () => {
    const { graph } = build(
      doc(`<theorem id="t">T.</theorem>
      <change by="x"><new><proof>One.</proof></new></change>
      <proof>Another.</proof>`),
    );
    expect(graph.nodes.get("t")!.proofs).toHaveLength(2);
  });

  it("is not linked when something else comes first", () => {
    const { graph, html } = build(
      doc(`<theorem id="t">T.</theorem><p>Some remark.</p><proof>P.</proof>
      <lemma id="l">L.</lemma> Prose. <proof>Q.</proof>`),
    );
    expect(graph.nodes.get("t")!.proofs).toEqual([]);
    expect(graph.nodes.get("l")!.proofs).toEqual([]);
    expect(html).not.toContain("data-of=");
  });
});

describe("aids on a step", () => {
  it("are allowed, folded, and never an edge", () => {
    const { diagnostics, graph, html } = build(
      doc(`<lemma id="a">A.</lemma><lemma id="l">L.</lemma>
      <proof of="l"><step><claim>c</claim><intuition>see <ref to="a"/></intuition>
        <change by="x"><new><strategy>s</strategy></new></change><proof>p</proof></step></proof>`),
    );
    expect(diagnostics).toEqual([]);
    expect(html).toContain('<delta-intuition collapsed="true">');
    expect(html).toContain('<delta-strategy collapsed="true">');
    expect(graph.nodes.get("l")!.parents).toEqual([]);
  });

  it("warns on two of the same, and still refuses an aid directly in a proof", () => {
    const { diagnostics } = build(
      doc(`<lemma id="l">L.</lemma>
      <proof of="l"><step><claim>c</claim><intuition>a</intuition><intuition>b</intuition></step></proof>`),
    );
    expect(diagnostics.map((d) => d.message)).toEqual([
      expect.stringMatching(/<step> has more than one <intuition>/),
    ]);
  });
});

describe("proofs joined to their box", () => {
  // In the page only: a remote proof is also snapshotted for its box's link preview.
  const attached = (html: string) =>
    [...html.split("<template data-delta-pop")[0].matchAll(/<delta-(proof|solution)\b[^>]*>/g)]
      .filter((m) => !m[0].includes("data-depth"))
      .map((m) => /data-attached="true"/.test(m[0]));

  it("joins a proof right after its result, the second proof after it, and one nested in it", () => {
    const { graph, html } = build(
      doc(`<lemma id="a">A.</lemma>
      <proof>One.</proof>
      <proof>Two.</proof>
      <lemma id="b">B.<proof>Inside.</proof></lemma>
      <lemma id="c">C.</lemma>
      <comment by="x">A note between them parts nothing.</comment>
      <proof of="c">Three.</proof>`),
    );
    expect(attached(html)).toEqual([true, true, true, true]);
    expect(graph.nodes.get("a")!.proofs).toHaveLength(2);
    expect(graph.nodes.get("b")!.proofs).toHaveLength(1);
    expect(graph.nodes.get("c")!.proofs).toHaveLength(1);
    expect(html).toContain('<delta-proof data-of="b" data-attached="true" collapsed="true">');
  });

  it("joins a solution to its exercise, with or without ids", () => {
    const { html } = build(
      doc(`<exercise>E.</exercise><solution>S.</solution>
      <problem id="p">P.<solution>Inside.</solution></problem>`),
    );
    expect(attached(html)).toEqual([true, true]);
  });

  it("leaves a proof away from its result alone, with an id its box links to", () => {
    const { html } = build(
      doc(`<lemma id="a">A.</lemma> Prose. <proof of="a">Far.</proof>
      <lemma id="b">B.</lemma><lemma id="z">Z.</lemma><proof of="b">Not next to b.</proof>`),
    );
    expect(attached(html)).toEqual([false, false]);
    expect(html).toContain('<delta-proof of="a" id="a-proof"');
    expect(html).toContain(
      '<delta-lemma id="a" num="1.1" data-proof-at="a-proof" data-proof-at-tag="proof" data-proof-at-num="">',
    );
  });

  it('starts joined proofs folded, unless the author or <document proofs="open"> says otherwise', () => {
    const folded = (src: string) =>
      [...build(src).html.matchAll(/<delta-proof [^>]*collapsed="(\w+)"/g)].map((m) => m[1]);
    const body = `<section><title>S</title><lemma id="a">A.</lemma><proof>P.</proof>
      <lemma id="b">B.</lemma><proof collapsed="false">Q.</proof></section>`;
    expect(folded(`<document>${body}</document>`)).toEqual(["true", "false"]);
    expect(folded(`<document proofs="open">${body}</document>`)).toEqual(["false", "false"]);
    expect(folded(`<document type="presentation"><slide>${body}</slide></document>`)).toEqual([
      "false",
      "false",
    ]);
  });

  it("names the heading a remote proof sits under, and marks an open result with no proof", () => {
    const { html } = build(
      `<document><section id="s1"><title>A</title><theorem id="t">T.</theorem>
        <lemma id="o" status="open">O.</lemma></section>
        <section id="s2"><title>B</title><proof of="t">P.</proof></section></document>`,
    );
    expect(html).toContain(
      'data-proof-at="t-proof" data-proof-at-tag="section" data-proof-at-num="2"',
    );
    expect(html).toContain('<delta-lemma id="o" status="open" num="1.1" data-proof="pending">');
  });

  it("keeps a nested proof out of the statement: its hash, its preview, `delta show`", () => {
    const nested = build(
      doc(`<lemma id="l">If $x$ then $y$.<proof>Because $z$.</proof></lemma>
      <theorem id="t">By <ref to="l"/>.</theorem>`),
    );
    const after = build(
      doc(`<lemma id="l">If $x$ then $y$.</lemma><proof>Because $z$.</proof>
      <theorem id="t">By <ref to="l"/>.</theorem>`),
    );
    expect(nested.graph.nodes.get("l")!.hash).toBe(after.graph.nodes.get("l")!.hash);
    expect(nested.graph.nodes.get("t")!.hash).toBe(after.graph.nodes.get("t")!.hash);
    const preview = /<template data-delta-pop="l">(.*?)<\/template>/s.exec(nested.html)![1];
    expect(preview).not.toContain("delta-proof");
    const rel = (f: string) => basename(f);
    const shown = showData(nested.graph, "l", rel, false)!;
    expect(shown.statement!.source).not.toContain("Because");
    expect(shown.proofs[0].source).toContain("Because");
    const context = showData(nested.graph, "t", rel, true)!.context!;
    expect(context[0].statement!.source).not.toContain("Because");
  });
});
