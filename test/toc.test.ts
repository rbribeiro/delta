import { describe, expect, it } from "vitest";
import { elements, type ElementNode } from "../src/compiler/ast";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { numberDocument } from "../src/compiler/numbering";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";
import { buildToc } from "../src/compiler/toc";

function built(src: string): { doc: ElementNode; ctx: CompileContext } {
  const ctx = createContext("test.dlt");
  const doc = parse(preprocess(src), ctx);
  if (!doc) throw new Error("parse failed: " + JSON.stringify(ctx.diagnostics));
  numberDocument(doc, ctx);
  buildToc(doc, ctx);
  return { doc, ctx };
}

function firstSection(doc: ElementNode): ElementNode | undefined {
  for (const el of elements(doc)) if (el.tag === "section") return el;
  return undefined;
}

function compile(src: string): string {
  const ctx = createContext("test.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return html;
}

describe("buildToc", () => {
  it("collects the heading tree with level, number and id in document order", () => {
    const { ctx } = built(`<document><toc/>
      <section id="a"><title>Intro</title>
        <subsection id="b"><title>Background</title>x</subsection>
      </section>
      <section id="c"><title>Methods</title>y</section>
    </document>`);
    expect(ctx.toc.map((e) => e.level)).toEqual([2, 3, 2]);
    expect(ctx.toc.map((e) => e.num)).toEqual(["1", "1.1", "2"]);
    expect(ctx.toc.map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("auto-generates a slug id for a section that lacks one, assigned back to the node", () => {
    const { doc, ctx } = built(
      `<document><toc/><section><title>Media Section</title>x</section></document>`,
    );
    expect(ctx.toc[0].id).toBe("media-section");
    expect(firstSection(doc)?.attrs.id).toBe("media-section");
  });

  it("de-duplicates colliding slugs", () => {
    const { ctx } = built(`<document><toc/>
      <section><title>Notes</title>a</section>
      <section><title>Notes</title>b</section>
    </document>`);
    expect(ctx.toc.map((e) => e.id)).toEqual(["notes", "notes-2"]);
  });

  it("does nothing (no entries, no id mutation) when the document has no <toc>", () => {
    const { doc, ctx } = built(`<document><section><title>X</title>y</section></document>`);
    expect(ctx.toc).toHaveLength(0);
    expect(firstSection(doc)?.attrs.id).toBeUndefined();
  });

  it("collects headings for a <toc> nested inside another tag (e.g. <floating>)", () => {
    const { ctx } = built(`<document>
      <floating><title>Navigate</title><toc/></floating>
      <section id="a"><title>Intro</title>x</section>
    </document>`);
    expect(ctx.toc.map((e) => e.id)).toEqual(["a"]);
  });
});

describe("emit with a table of contents", () => {
  it("ships the heading tree as the #delta-toc island and passes <toc> through", () => {
    const html = compile(
      `<document><toc depth="3"/><section id="a"><title>Intro</title>x</section></document>`,
    );
    expect(html).toContain('<script type="application/json" id="delta-toc">');
    expect(html).toContain('<delta-toc depth="3">');
    expect(html).toContain('"id":"a"');
    expect(html).toContain('"title":"Intro"');
  });

  it("ships the island and renames <floating> when the <toc> is nested in it", () => {
    const html = compile(
      `<document><floating><title>Navigate</title><toc/></floating>` +
        `<section id="a"><title>Intro</title>x</section></document>`,
    );
    expect(html).toContain("<delta-floating>");
    expect(html).toContain('<script type="application/json" id="delta-toc">');
    expect(html).toContain('"id":"a"');
  });

  it("emits no island when there is no <toc>", () => {
    const html = compile(`<document><section id="a"><title>Intro</title>x</section></document>`);
    expect(html).not.toContain('id="delta-toc"');
  });

  it("keeps the offline invariant", () => {
    const html = compile(
      `<document><toc/><section id="a"><title>Intro</title>x</section></document>`,
    );
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) {
      expect(m[1]).toMatch(/^["']?data:/);
    }
  });

  it("preserves custom title content inside <toc> when emitting", () => {
    const html = compile(
      `<document><toc><title>Table of Contents</title></toc>` +
        `<section id="a"><title>Intro</title>x</section></document>`,
    );
    expect(html).toContain("<delta-title>Table of Contents</delta-title>");
  });
});
