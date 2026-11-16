import { describe, expect, it } from "./harness.ts";
import { loadBibliography } from "../src/compiler/bibliography.ts";
import type { CompileContext } from "../src/compiler/context.ts";
import { compile as compileAll, compileHtml, parsed, warnings } from "./helpers.ts";

// The document lives in test/, so a `src` resolves relative to test/.
const FILE = "test/doc.dlt";

/** Parsed and papers loaded: the loading pass by hand. */
function load(src: string) {
  const out = parsed(src, FILE);
  loadBibliography(out.doc, out.ctx);
  return out;
}

/** The whole pipeline: citations numbered, bibliography filled, HTML emitted. */
const full = (src: string): { html: string; ctx: CompileContext } =>
  compileAll(src, { file: FILE });
const compile = (src: string): string => compileHtml(src, { file: FILE });

/** `data-cite-nums` of every emitted `<delta-cite paper…>`, in document order (undefined: inert).
 *  Attributes required: the runtime's own source mentions a bare `<delta-cite>`. */
const citeNums = (html: string): (string | undefined)[] =>
  [...html.matchAll(/<delta-cite\s([^>]*)>/g)].map(
    (m) => /data-cite-nums="([^"]*)"/.exec(m[1])?.[1],
  );
/** Ids of the `<delta-paper>`s inside `<delta-bibliography>`, in order (not the pop-over templates). */
const bibPaperIds = (html: string): string[] => {
  const bib = /<delta-bibliography[\s>][\s\S]*?<\/delta-bibliography>/.exec(html)?.[0] ?? "";
  return [...bib.matchAll(/<delta-paper id="([^"]*)"/g)].map((m) => m[1]);
};
const warned = (ctx: CompileContext, re: RegExp): boolean => warnings(ctx).some((m) => re.test(m));

describe("loadBibliography", () => {
  it("collects inline <paper> entries into ctx.papers", () => {
    const { ctx } = load(
      `<document><bibliography><paper id="A"><title>T</title></paper></bibliography>
        <cite paper="A" /></document>`,
    );
    expect(ctx.papers.has("A")).toBe(true);
    expect(ctx.diagnostics.filter((d) => d.severity === "warning")).toHaveLength(0);
  });

  it("loads + merges papers from a .ref src", () => {
    const { ctx } = load(
      `<document><bibliography src="fixtures/refs.ref" /><cite paper="ARS10" /></document>`,
    );
    expect([...ctx.papers.keys()].sort()).toEqual(["ARS10", "KL98", "UNCITED"]);
  });

  it("warns and skips a missing .ref file", () => {
    const { ctx } = load(`<document><bibliography src="fixtures/nope.ref" /></document>`);
    expect(ctx.papers.size).toBe(0);
    expect(warned(ctx, /not found/)).toBe(true);
  });

  it("warns on a remote src", () => {
    const { ctx } = load(`<document><bibliography src="https://x.test/a.ref" /></document>`);
    expect(warned(ctx, /not a URL/)).toBe(true);
  });

  it("warns on a duplicate paper id and an id-less paper", () => {
    const { ctx } = load(
      `<document><bibliography>
        <paper id="A"><title>One</title></paper>
        <paper id="A"><title>Two</title></paper>
        <paper><title>No id</title></paper>
      </bibliography></document>`,
    );
    expect(warned(ctx, /duplicate paper id/)).toBe(true);
    expect(warned(ctx, /without an 'id'/)).toBe(true);
  });
});

describe("citations (numberCitations + the bibliography fill)", () => {
  it("numbers citations in first-appearance order", () => {
    const { html } = full(
      `<document><bibliography src="fixtures/refs.ref" />
        first <cite paper="KL98" /> then <cite paper="ARS10" /></document>`,
    );
    expect(citeNums(html)).toEqual(["1", "2"]); // KL98 cited first
  });

  it("reuses a paper's number when cited again", () => {
    const { html } = full(
      `<document><bibliography src="fixtures/refs.ref" />
        <cite paper="ARS10" /> <cite paper="KL98" /> <cite paper="ARS10" /></document>`,
    );
    expect(citeNums(html)).toEqual(["1", "2", "1"]);
  });

  it("renders a multi-id citation as a parallel num/id list", () => {
    const { html } = full(
      `<document><bibliography src="fixtures/refs.ref" /><cite papers="ARS10, KL98" /></document>`,
    );
    expect(html).toContain('data-cite-nums="1,2" data-cite-ids="ARS10,KL98"');
  });

  it("warns on an unknown id and leaves an all-unknown cite inert", () => {
    const { html, ctx } = full(
      `<document><bibliography src="fixtures/refs.ref" /><cite paper="NOPE" /></document>`,
    );
    expect(warned(ctx, /unknown paper "NOPE"/)).toBe(true);
    expect(citeNums(html)).toEqual([undefined]);
  });

  it("warns on a cite with no paper/papers", () => {
    const { ctx } = full(`<document><bibliography src="fixtures/refs.ref" /><cite /></document>`);
    expect(warned(ctx, /without a 'paper'/)).toBe(true);
  });

  it("records cited ids in referencedIds (for emit's template snapshot)", () => {
    const { ctx } = full(
      `<document><bibliography src="fixtures/refs.ref" /><cite paper="ARS10" /></document>`,
    );
    expect(ctx.referencedIds.has("ARS10")).toBe(true);
  });

  it("fills the bibliography with only cited papers, in citation order", () => {
    const { html } = full(
      `<document><bibliography src="fixtures/refs.ref" />
        <cite paper="KL98" /> <cite paper="ARS10" /></document>`,
    );
    expect(bibPaperIds(html)).toEqual(["KL98", "ARS10"]); // UNCITED dropped
  });

  it("warns when citations exist but there is no <bibliography>", () => {
    const { ctx } = full(`<document><cite paper="X" /></document>`);
    // X is unknown (no bibliography loaded), so we warn about the unknown paper…
    expect(warned(ctx, /unknown paper/)).toBe(true);
  });
});

describe("emit with a bibliography", () => {
  const doc = (body: string) =>
    `<document><title>T</title><section id="s"><title>S</title>${body}</section>
      <bibliography src="fixtures/refs.ref" /></document>`;

  it("ships the resolved cite, the cited papers, and a snapshot template", () => {
    const html = compile(doc(`Claim <cite paper="ARS10" /> and <cite papers="ARS10,KL98" />.`));
    expect(html).toContain('<delta-cite paper="ARS10" data-cite-nums="1" data-cite-ids="ARS10">');
    expect(html).toContain('<delta-paper id="ARS10"');
    expect(html).toContain('<delta-paper id="KL98"');
    expect(html).not.toContain("UNCITED"); // only cited papers ship
    expect(html).toContain('<template data-delta-pop="ARS10">');
  });

  it("keeps the offline invariant", () => {
    const html = compile(doc(`Claim <cite paper="ARS10" />.`));
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) {
      expect(m[1]).toMatch(/^["']?data:/);
    }
  });
});

describe("emit with a bibliography with custom title", () => {
  const doc = (
    body: string,
  ) => `<document><title>T</title><section id="s"><title>S</title>${body}</section>
  <bibliography src="fixtures/refs.ref"><title>My Custom Title</title></bibliography></document>`;

  it("preserves the custom <title> ahead of the cited papers", () => {
    const html = compile(doc(`Claim <cite paper="ARS10" /> and <cite papers="ARS10,KL98" />.`));
    // The title survives the database-consume step and ships as the first child;
    // the runtime (DeltaBibliography) turns it into the <h4> heading in the browser.
    expect(html).toMatch(/<delta-bibliography[^>]*><delta-title>My Custom Title<\/delta-title>/);
    expect(html).toContain('<delta-paper id="ARS10"'); // papers still ship after it
  });
});
