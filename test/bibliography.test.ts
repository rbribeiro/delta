import { describe, expect, it } from "vitest";
import { elements, type ElementNode } from "../src/compiler/ast";
import { loadBibliography, resolveCitations } from "../src/compiler/bibliography";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";

// ctx.file lives in test/, so a `src` resolves relative to test/.
function run(src: string): { doc: ElementNode; ctx: CompileContext } {
  const ctx = createContext("test/doc.dlt");
  const doc = parse(preprocess(src), ctx);
  if (!doc) throw new Error("parse failed: " + JSON.stringify(ctx.diagnostics));
  loadBibliography(doc, ctx);
  resolveCitations(doc, ctx);
  return { doc, ctx };
}

function compile(src: string): string {
  const ctx = createContext("test/doc.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return html;
}

const bibPaperIds = (doc: ElementNode): string[] => {
  const bib = [...elements(doc)].find((e) => e.tag === "bibliography");
  return (bib?.children ?? [])
    .filter((c): c is ElementNode => c.type === "element" && c.tag === "paper")
    .map((p) => p.attrs.id);
};
const cite = (doc: ElementNode): ElementNode | undefined =>
  [...elements(doc)].find((e) => e.tag === "cite");
const warned = (ctx: CompileContext, re: RegExp): boolean =>
  ctx.diagnostics.some((d) => d.severity === "warning" && re.test(d.message));

describe("loadBibliography", () => {
  it("collects inline <paper> entries into ctx.papers", () => {
    const { ctx } = run(
      `<document><bibliography><paper id="A"><title>T</title></paper></bibliography>
        <cite paper="A" /></document>`,
    );
    expect(ctx.papers.has("A")).toBe(true);
    expect(ctx.diagnostics.filter((d) => d.severity === "warning")).toHaveLength(0);
  });

  it("loads + merges papers from a .ref src", () => {
    const { ctx } = run(`<document><bibliography src="fixtures/refs.ref" /><cite paper="ARS10" /></document>`);
    expect([...ctx.papers.keys()].sort()).toEqual(["ARS10", "KL98", "UNCITED"]);
  });

  it("warns and skips a missing .ref file", () => {
    const { ctx } = run(`<document><bibliography src="fixtures/nope.ref" /></document>`);
    expect(ctx.papers.size).toBe(0);
    expect(warned(ctx, /not found/)).toBe(true);
  });

  it("warns on a remote src", () => {
    const { ctx } = run(`<document><bibliography src="https://x.test/a.ref" /></document>`);
    expect(warned(ctx, /not a URL/)).toBe(true);
  });

  it("warns on a duplicate paper id and an id-less paper", () => {
    const { ctx } = run(
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

describe("resolveCitations", () => {
  it("numbers citations in first-appearance order", () => {
    const { doc } = run(
      `<document><bibliography src="fixtures/refs.ref" />
        first <cite paper="KL98" /> then <cite paper="ARS10" /></document>`,
    );
    const cites = [...elements(doc)].filter((e) => e.tag === "cite");
    expect(cites[0].attrs["data-cite-nums"]).toBe("1"); // KL98 cited first
    expect(cites[1].attrs["data-cite-nums"]).toBe("2");
  });

  it("reuses a paper's number when cited again", () => {
    const { doc } = run(
      `<document><bibliography src="fixtures/refs.ref" />
        <cite paper="ARS10" /> <cite paper="KL98" /> <cite paper="ARS10" /></document>`,
    );
    const cites = [...elements(doc)].filter((e) => e.tag === "cite");
    expect(cites.map((c) => c.attrs["data-cite-nums"])).toEqual(["1", "2", "1"]);
  });

  it("renders a multi-id citation as a parallel num/id list", () => {
    const { doc } = run(
      `<document><bibliography src="fixtures/refs.ref" /><cite papers="ARS10, KL98" /></document>`,
    );
    const c = cite(doc)!;
    expect(c.attrs["data-cite-nums"]).toBe("1,2");
    expect(c.attrs["data-cite-ids"]).toBe("ARS10,KL98");
  });

  it("warns on an unknown id and leaves an all-unknown cite inert", () => {
    const { doc, ctx } = run(
      `<document><bibliography src="fixtures/refs.ref" /><cite paper="NOPE" /></document>`,
    );
    expect(warned(ctx, /unknown paper "NOPE"/)).toBe(true);
    expect(cite(doc)!.attrs["data-cite-nums"]).toBeUndefined();
  });

  it("warns on a cite with no paper/papers", () => {
    const { ctx } = run(`<document><bibliography src="fixtures/refs.ref" /><cite /></document>`);
    expect(warned(ctx, /without a 'paper'/)).toBe(true);
  });

  it("records cited ids in referencedIds (for emit's template snapshot)", () => {
    const { ctx } = run(`<document><bibliography src="fixtures/refs.ref" /><cite paper="ARS10" /></document>`);
    expect(ctx.referencedIds.has("ARS10")).toBe(true);
  });

  it("fills the bibliography with only cited papers, in citation order", () => {
    const { doc } = run(
      `<document><bibliography src="fixtures/refs.ref" />
        <cite paper="KL98" /> <cite paper="ARS10" /></document>`,
    );
    expect(bibPaperIds(doc)).toEqual(["KL98", "ARS10"]); // UNCITED dropped
  });

  it("warns when citations exist but there is no <bibliography>", () => {
    const { ctx } = run(`<document><cite paper="X" /></document>`);
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
  const doc = (body: string) => `<document><title>T</title><section id="s"><title>S</title>${body}</section>
  <bibliography src="fixtures/refs.ref"><title>My Custom Title</title></bibliography></document>`;

  it("preserves the custom <title> ahead of the cited papers", () => {
    const html = compile(doc(`Claim <cite paper="ARS10" /> and <cite papers="ARS10,KL98" />.`));
    // The title survives the database-consume step and ships as the first child;
    // the runtime (DeltaBibliography) turns it into the <h4> heading in the browser.
    expect(html).toMatch(/<delta-bibliography[^>]*><delta-title>My Custom Title<\/delta-title>/);
    expect(html).toContain('<delta-paper id="ARS10"'); // papers still ship after it
  });
})
