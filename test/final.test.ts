import { describe, expect, it } from "vitest";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";

function compile(src: string, final: boolean): { html: string; ctx: CompileContext } {
  const ctx = createContext("test.dlt");
  ctx.final = final;
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

/** The rendered document only: no inlined CSS/JS (whose comments mention tags) and no <template> snapshots. */
const body = (html: string): string => html.slice(html.indexOf("<delta-document"), html.indexOf("</delta-document>"));
const nums = (html: string): string[] =>
  [...body(html).matchAll(/<delta-(theorem|equation|lemma)[^>]*\bnum="([^"]+)"/g)].map((m) => `${m[1]}:${m[2]}`);

const MARKED = `<document>
  <team><member id="ai" name="Claude" kind="agent"/></team>
  <review/>
  <section id="s"><title>S</title>
    <lemma id="l" status="review" by="ai" verified-by="rb"><title>L</title>x</lemma>
    <theorem id="t">y<comment by="ai">quoted <equation id="q">z</equation></comment></theorem>
    <equation id="e">w</equation>
    <todo for="ai">do</todo>
    <draft by="ai" note="n">loose prose</draft>
    Sign: <change by="ai"><old>$x < 0$</old><new>$x > 0$</new></change>.
    <change by="ai">inserted.</change>
    <change by="ai"><old>deleted.</old></change>
    <proof of="l" status="verified">done</proof>
  </section>
</document>`;

const CLEAN = `<document>
  <section id="s"><title>S</title>
    <lemma id="l"><title>L</title>x</lemma>
    <theorem id="t">y</theorem>
    <equation id="e">w</equation>
    loose prose
    Sign: $x > 0$.
    inserted.
    <proof of="l">done</proof>
  </section>
</document>`;

describe("--final", () => {
  it("strips comments, tasks, the panel and the team; unwraps drafts; accepts changes; drops the marks", () => {
    const { html } = compile(MARKED, true);
    const doc = body(html);
    for (const tag of ["comment", "reply", "todo", "review", "team", "member", "draft", "change", "old", "new"]) {
      expect(doc, tag).not.toContain(`<delta-${tag}`);
    }
    expect(html).not.toContain('id="delta-review"');
    expect(doc).toContain("loose prose");
    expect(doc).toContain("inserted.");
    expect(doc).not.toContain("deleted.");
    expect(doc).not.toMatch(/<delta-[a-z]+[^>]*\b(status|by|verified-by)=/);
    expect(doc).toContain('<delta-lemma id="l" num="1.1">');
    // the accepted <new> side survives as rendered math; the <old> side is gone
    expect(doc).toContain("x &gt; 0"); // KaTeX's TeX annotation of the kept side
    expect(doc).not.toContain("x &lt; 0");
  });

  it("numbers the paper exactly like the same source written without the markup", () => {
    const marked = compile(MARKED, true).html;
    const clean = compile(CLEAN, false).html;
    expect(nums(marked)).toEqual(nums(clean));
    expect(nums(marked)).toEqual(["lemma:1.1", "theorem:1.1", "equation:1.1"]);
    // …and the review build numbers the same way too (OPAQUE keeps quoted things out)
    expect(nums(compile(MARKED, false).html)).toEqual(nums(clean));
  });

  it("keeps a <cite> quoted in a dropped comment out of the bibliography", () => {
    const src = `<document>
      <bibliography><paper id="p"><title>T</title><author>A</author><year>2000</year></paper></bibliography>
      <section id="s"><title>S</title>x<comment by="a">see <cite paper="p"/></comment></section>
    </document>`;
    const { html, ctx } = compile(src, true);
    expect(body(html)).not.toContain("<delta-paper");
    expect(ctx.citedPapers).toEqual([]);
    expect(body(compile(src, false).html)).toContain("<delta-paper");
  });

  it("warns once with what is left undone", () => {
    const { ctx } = compile(MARKED, true);
    const w = ctx.diagnostics.filter((d) => d.severity === "warning");
    expect(w).toHaveLength(1);
    // 1 open comment; 1 open task; lemma (review) + draft = 2 blocks not verified (the proof is verified)
    expect(w[0].message).toBe("final build: 1 open comment, 1 open task, 2 blocks not verified");
  });

  it("is silent when everything is resolved, done and verified", () => {
    const { ctx, html } = compile(`<document><section id="s"><title>S</title>
      <lemma status="verified" verified-by="rb">x<comment by="a" status="resolved">ok</comment></lemma>
      <todo for="a" status="done">did</todo></section></document>`, true);
    expect(ctx.diagnostics).toEqual([]);
    expect(html).not.toContain("<delta-comment");
  });

  it("is a no-op without the flag", () => {
    const { html, ctx } = compile(MARKED, false);
    expect(html).toContain("<delta-comment");
    expect(html).toContain("<delta-change");
    expect(ctx.diagnostics.some((d) => d.message.startsWith("final build"))).toBe(false);
  });
});
