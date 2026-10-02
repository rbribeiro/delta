import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { compileProject } from "../src/compiler/project";
import { compile } from "./helpers";

/** Compiles without throwing, so a test can look at the errors. */
function attempt(src: string): CompileContext {
  const ctx = createContext("test.dlt");
  compileSource(src, ctx);
  return ctx;
}

const messages = (ctx: CompileContext, severity: "error" | "warning"): string[] =>
  ctx.diagnostics.filter((d) => d.severity === severity).map((d) => d.message);

const GIANT = `<theorem id="thm:giant">
  <title>Giant component</title>
  If $c > 1$, a giant component exists.
  <intuition>Exploration looks like a Poisson($c$) tree.</intuition>
  <strategy>Couple (<ref to="lem:coupling"/>), then sprinkle.</strategy>
  <obstacle>The coupling only holds while the explored set is $o(n)$.</obstacle>
</theorem>
<lemma id="lem:coupling" status="open">Coupling with a branching process.</lemma>
See <ref to="thm:giant"/>.`;

const doc = (body: string, type = "article"): string =>
  `<document type="${type}"><section id="s"><title>S</title>${body}</section></document>`;

describe("reader aids on a result", () => {
  it("compiles all three with math and refs, all folded by default", () => {
    const { html, ctx } = compile(doc(GIANT));
    expect(messages(ctx, "error")).toEqual([]);
    expect(messages(ctx, "warning")).toEqual([]);
    expect(html).toContain('<delta-intuition collapsed="true">');
    expect(html).toContain('<delta-strategy collapsed="true">');
    expect(html).toContain('<delta-obstacle collapsed="true">');
    // math rendered and the ref resolved inside the aids
    expect(html).toMatch(/<delta-intuition[^>]*>[^]*class="katex"/);
    expect(html).toMatch(
      /<delta-strategy[^>]*>[^]*<delta-ref to="lem:coupling" data-target-num="1\.1"/,
    );
  });

  it("is not numbered and never registers as a ref target", () => {
    const { ctx } = compile(doc(GIANT));
    expect([...ctx.registry.keys()].sort()).toEqual(["lem:coupling", "s", "thm:giant"]);
  });

  it("folds by default in a presentation too", () => {
    const { html } = compile(doc(GIANT, "presentation"));
    expect(html).toContain('<delta-intuition collapsed="true">');
  });

  it("keeps an author's collapsed", () => {
    const { html } = compile(
      doc(`<lemma id="l">x<strategy collapsed="false">s</strategy></lemma>`),
    );
    expect(html).toContain('<delta-strategy collapsed="false">');
  });

  it("previews the whole result, aids included (the runtime shows them folded)", () => {
    const { html } = compile(doc(GIANT));
    const tpl = html.match(/<template data-delta-pop="thm:giant">([^]*?)<\/template>/)?.[1] ?? "";
    expect(tpl).toContain("a giant component exists");
    for (const aid of ["intuition", "strategy", "obstacle"]) expect(tpl).toContain(`<delta-${aid}`);
  });
});

describe("placement", () => {
  it("is an error, with its line, for an aid outside a result", () => {
    const ctx = attempt(`<document>
<section id="s"><title>S</title>
  <strategy>loose</strategy>
</section>
</document>`);
    const err = ctx.diagnostics.find((d) => d.severity === "error");
    expect(err?.message).toMatch(
      /<strategy> must be a direct child of a numbered result .*found inside <section>/,
    );
    expect(err?.pos?.line).toBe(3);
  });

  it("refuses an aid directly inside a proof", () => {
    const ctx = attempt(
      doc(`<lemma id="l">x</lemma>
      <proof of="l"><intuition>no</intuition></proof>`),
    );
    expect(messages(ctx, "error")).toEqual([
      expect.stringMatching(
        /<intuition> must be a direct child .*or of a <step>; found inside <proof>/,
      ),
    ]);
  });

  it("treats <heuristic> like any tag it does not know (the element was removed)", () => {
    const { html, ctx } = compile(doc(`<lemma id="l">x</lemma><heuristic>h</heuristic>`));
    expect(ctx.diagnostics).toEqual([]);
    expect(html).toContain("<delta-heuristic>h</delta-heuristic>");
  });

  it("looks through collaboration wrappers", () => {
    const ctx = attempt(
      doc(`<lemma id="l">x<change by="a"><new><intuition>i</intuition></new></change></lemma>`),
    );
    expect(messages(ctx, "error")).toEqual([]);
  });

  it("rejects an id on an aid", () => {
    const ctx = attempt(doc(`<lemma id="l">x<intuition id="i">i</intuition></lemma>`));
    expect(messages(ctx, "error")).toEqual([
      expect.stringMatching(/<intuition> cannot carry an id/),
    ]);
  });

  it("warns on two of the same aid", () => {
    const { ctx } = compile(
      doc(`<lemma id="l">x<intuition>a</intuition><intuition>b</intuition></lemma>`),
    );
    expect(messages(ctx, "warning")).toEqual([expect.stringMatching(/more than one <intuition>/)]);
  });
});

describe('status="open"', () => {
  it("marks a planned result, and is unknown anywhere else", () => {
    const { html, ctx } = compile(`<document>
      <section id="s" status="open"><title>S</title>
        <lemma id="l" status="open">planned</lemma>
      </section>
    </document>`);
    expect(html).toContain('<delta-lemma id="l" status="open"');
    expect(messages(ctx, "warning")).toEqual([
      '<section> has unknown status "open" (expected draft, heuristic, sketch, review, verified or formalized)',
    ]);
  });
});

describe("across chapters", () => {
  it("resolves a ref in a strategy to a result in another file", () => {
    const dir = mkdtempSync(join(tmpdir(), "delta-aids-"));
    writeFileSync(
      join(dir, "a.dlt"),
      `<document><section id="a"><title>A</title>
      <lemma id="lem:a">Base.</lemma></section></document>`,
    );
    writeFileSync(
      join(dir, "b.dlt"),
      `<document><section id="b"><title>B</title>
      <theorem id="thm:b">Main.<strategy>Use <ref to="lem:a"/>.</strategy></theorem></section></document>`,
    );
    const r = compileProject({ inputs: [join(dir, "a.dlt"), join(dir, "b.dlt")], outDir: "out" });
    expect(r.diagnostics).toEqual([]);
    const b = r.outputs.find((o) => o.path.endsWith("b.html"))!.html;
    expect(b).toMatch(
      /<delta-strategy[^>]*>Use <delta-ref to="lem:a"[^>]*data-target-href="a\.html#lem:a"/,
    );
  });
});
