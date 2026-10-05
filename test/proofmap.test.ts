import { describe, expect, it } from "./harness.ts";
import { compileFiles as build } from "./helpers.ts";

const doc = (body: string) =>
  `<document lang="pt-BR"><section id="s"><title>S</title>${body}</section></document>`;

/** Every box: its ref target, effective trust and top coordinate. */
function boxes(html: string): { to: string; eff: string; top: number }[] {
  return [
    ...html.matchAll(
      /<delta-pm-node data-eff="(\w+)"[^>]*style="left:[\d.]+px;top:([\d.]+)px[^"]*"><delta-ref to="([^"]+)"/g,
    ),
  ].map((m) => ({ to: m[3], eff: m[1], top: Number(m[2]) }));
}

const PLAN = doc(`
  <definition id="d"><title>A definição</title>D.</definition>
  <lemma id="a"><title>Base $x$</title>By <ref to="d"/>.</lemma><proof of="a" status="verified">p</proof>
  <lemma id="b" status="open">B.</lemma>
  <lemma id="unrelated">U.</lemma>
  <theorem id="t">T.</theorem><proof of="t" status="sketch">By <ref to="a"/> and <ref to="b"/>.</proof>
  <proof-map of="t"/>`);

describe("<proof-map of>", () => {
  it("draws the result and its ancestors (only), each box a resolved ref coloured by effective trust", () => {
    const { html, diagnostics } = build({ "p.dlt": PLAN });
    expect(diagnostics.filter((d) => d.severity === "error")).toEqual([]);
    const map = boxes(html("p.html"));
    expect(map.map((b) => [b.to, b.eff]).sort()).toEqual([
      ["a", "verified"],
      ["b", "open"],
      ["d", "verified"],
      ["t", "open"],
    ]);
    expect(html("p.html")).toMatch(
      /<delta-pm-node[^>]*><delta-ref to="a" data-target-num="1\.1" data-target-tag="lemma">/,
    );
    // own trust above effective is flagged, with a localized hover text
    expect(html("p.html")).toMatch(/data-eff="open" data-own="sketch" title="Esboço → Em aberto"/);
  });

  it("puts each result above what uses it", () => {
    const top = Object.fromEntries(
      boxes(build({ "p.dlt": PLAN }).html("p.html")).map((b) => [b.to, b.top]),
    );
    expect(top.d).toBeLessThan(top.a);
    expect(top.a).toBeLessThan(top.t);
    expect(top.b).toBe(top.a); // used only by t: sits right above it, not at the top
  });

  it("renders the copied title's math and draws one edge per use, plus a legend of what is shown", () => {
    const out = build({ "p.dlt": PLAN }).html("p.html");
    expect(out).toMatch(/<delta-pm-title>Base <span class="katex/);
    const svg = out.match(/<svg class="pm-edges"[^]*?<\/svg>/)![0];
    expect(svg.match(/marker-end=/g)).toHaveLength(3); // d→a, a→t, b→t
    expect(out).toMatch(
      /<delta-pm-legend><delta-pm-key data-eff="open">Em aberto<\/delta-pm-key><delta-pm-key data-eff="verified">Verificado<\/delta-pm-key><\/delta-pm-legend>/,
    );
  });

  it("links across chapters", () => {
    const { html } = build({
      "a.dlt": `<document><section id="sa"><title>A</title><lemma id="a">A.</lemma></section></document>`,
      "b.dlt": `<document><section id="sb"><title>B</title><theorem id="t">By <ref to="a"/>.</theorem><proof-map of="t"/></section></document>`,
    });
    expect(html("b.html")).toMatch(
      /<delta-pm-node[^>]*><delta-ref to="a"[^>]*data-target-href="a\.html#a"/,
    );
  });

  it("draws the whole graph without `of`, and a cycle's closing edge apart", () => {
    const { html } = build({
      "p.dlt": doc(`<lemma id="a">A.</lemma><proof of="a">By <ref to="b"/>.</proof>
        <lemma id="b">B.</lemma><proof of="b">By <ref to="a"/>.</proof><proof-map/>`),
    });
    expect(
      boxes(html("p.html"))
        .map((b) => b.to)
        .sort(),
    ).toEqual(["a", "b"]);
    expect(html("p.html")).toContain('class="pm-back"');
  });

  it("is an error for an unknown `of`", () => {
    const { diagnostics } = build({ "p.dlt": doc(`<proof-map of="nope"/>`) });
    expect(diagnostics.map((d) => d.message)).toContain(
      '<proof-map of="nope">: no result with that id',
    );
  });
});
