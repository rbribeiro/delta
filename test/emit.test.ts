import { describe, expect, it } from "vitest";
import { createContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { THEMES } from "../src/generated/assets";

function compile(src: string) {
  const ctx = createContext("test.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

const DOC = `<document lang="en">
  <title>T</title>
  <section id="s"><title>S</title>
    Inline $a < b$ and a literal \\$5.
    <theorem id="t"><title>Thm</title>body
      <equation id="e">x^2</equation>
    </theorem>
  </section>
</document>`;

describe("emit", () => {
  it("renames every tag to delta-* with compile-time data as attributes", () => {
    const { html } = compile(DOC);
    expect(html).toContain('<delta-section id="s" num="1">');
    expect(html).toContain('<delta-theorem id="t" num="1.1">');
    expect(html).toContain('<delta-equation id="e" num="1.1">');
  });

  it("renders math at compile time (no LaTeX source survives)", () => {
    const { html } = compile(DOC);
    expect(html).toContain('class="katex"');
    expect(html).not.toContain("$a");
  });

  it("unescapes \\$ into a literal dollar", () => {
    const { html } = compile(DOC);
    expect(html).toContain("a literal $5.");
  });

  it("inlines the runtime and sets the document title", () => {
    const { html } = compile(DOC);
    expect(html).toContain("customElements.define");
    expect(html).toContain("<title>T</title>");
  });

  it("includes KaTeX CSS (with data: fonts) only when math is used", () => {
    const { html } = compile(DOC);
    expect(html).toContain("KaTeX_Main");
    const plain = compile("<document><section id='s'><title>S</title>text</section></document>");
    expect(plain.ctx.mathUsed).toBe(false);
    expect(plain.html).not.toContain("KaTeX_Main");
  });

  it("inlines the @layer delta.theme overrides for the document `type` (default article)", () => {
    const body = `<title>T</title><section id="s"><title>S</title>text</section>`;
    const book = compile(`<document type="book">${body}</document>`).html;
    expect(book).toContain(THEMES.book);

    const dflt = compile(`<document>${body}</document>`).html;
    expect(dflt).toContain(THEMES.article);
    expect(dflt).not.toContain(THEMES.book);
  });

  it("activates the presentation deck: data-type hook + presentation theme", () => {
    const body = `<title>T</title><section id="s"><title>S</title>text</section>`;
    const deck = compile(`<document type="presentation">${body}</document>`).html;
    expect(deck).toContain('<html lang="en" data-type="presentation">');
    expect(deck).toContain(THEMES.presentation);

    // Default (article) docs keep the bare <html> tag and omit the presentation theme.
    const dflt = compile(`<document>${body}</document>`).html;
    expect(dflt).toContain('<html lang="en">');
    expect(dflt).not.toContain(THEMES.presentation);
  });

  it("opts into dark mode via theme-mode → data-mode on <html>", () => {
    const body = `<title>T</title><section id="s"><title>S</title>text</section>`;
    const dark = compile(`<document theme-mode="dark">${body}</document>`).html;
    expect(dark).toMatch(/<html lang="en"[^>]*\bdata-mode="dark"/);

    const auto = compile(`<document theme-mode="auto">${body}</document>`).html;
    expect(auto).toMatch(/<html lang="en"[^>]*\bdata-mode="auto"/);

    // Default (and explicit light) docs carry no data-mode on the tag. Assert on the
    // <html> tag, not a bare `data-mode=` substring — it appears in the inlined
    // [data-mode="dark"] CSS either way.
    const dflt = compile(`<document>${body}</document>`).html;
    expect(dflt).toContain('<html lang="en">');
    const light = compile(`<document theme-mode="light">${body}</document>`).html;
    expect(light).toContain('<html lang="en">');
    expect(light.match(/<html[^>]*>/)?.[0]).not.toContain("data-mode");
  });

  it("renders <slide> as a paged deck element without taking its title as the doc title", () => {
    const { html } = compile(
      `<document type="presentation">
        <title>Deck</title>
        <slide><title>First</title>hello</slide>
        <slide><title>Second</title>world</slide>
      </document>`,
    );
    // Generic rename: the slide is a delta-slide the runtime upgrades + pages.
    expect(html).toContain("<delta-slide>");
    expect(html).toContain("customElements.define(\"delta-slide\"");
    // The document title comes from the doc-level <title>, not a slide's <title>.
    expect(html).toContain("<title>Deck</title>");
    expect(html).not.toContain("<title>First</title>");
  });

  it("passes the opt-in <progress> marker through to the runtime", () => {
    // No compiler pass: the marker rides through as <delta-progress>; the runtime
    // detects it and turns on the per-slide progress line.
    const { html } = compile(
      `<document type="presentation"><title>D</title><progress/>
        <slide><title>S</title>x</slide>
      </document>`,
    );
    expect(html).toContain("<delta-progress>");
  });

  it("passes reveal/reveal-order fragment attributes through to the runtime", () => {
    // No compiler pass (the collapsible model): the deck controller reads them.
    const { html } = compile(
      `<document type="presentation"><title>D</title>
        <slide><title>S</title>
          <equation reveal="true" reveal-order="2">x</equation>
        </slide>
      </document>`,
    );
    expect(html).toContain('<delta-equation reveal="true" reveal-order="2"');
  });

  it('animated="true" adds reveal to child elements but not the title', () => {
    const { html } = compile(
      `<document type="presentation"><title>D</title>
        <slide animated="true"><title>S</title>
          <equation>x</equation>
          <equation>y</equation>
        </slide>
      </document>`,
    );
    // each content child becomes a fragment…
    expect([...html.matchAll(/<delta-equation[^>]*\breveal="true"/g)]).toHaveLength(2);
    // …but a <title> is never revealed (it stays visible).
    expect(html).not.toMatch(/<delta-title[^>]*\breveal=/);
  });

  it('does not expand animated="true" outside a presentation', () => {
    const { html } = compile(
      `<document><title>D</title>
        <section animated="true"><title>S</title><equation>x</equation></section>
      </document>`,
    );
    // The pass is a no-op off-deck, so the equation element gets no reveal attribute.
    // (`reveal="true"` still appears in the inlined deck CSS, so check the element.)
    expect(html).not.toMatch(/<delta-equation[^>]*\breveal=/);
  });

  it("desugars <cover> to a cover slide in a presentation", () => {
    const { html } = compile(
      `<document type="presentation"><title>D</title>
        <cover><title>Talk</title><subtitle>Sub</subtitle><author>Me</author></cover>
      </document>`,
    );
    expect(html).toContain('<delta-slide cover="true">');
    expect(html).toContain("<delta-subtitle>Sub</delta-subtitle>");
    expect(html).not.toContain("<delta-cover>");
    // the cover's own <title> is nested, so the page <title> stays the doc title.
    expect(html).toContain("<title>D</title>");
  });

  it("leaves <cover> untouched outside a presentation", () => {
    const { html } = compile(`<document><title>D</title><cover><title>X</title></cover></document>`);
    expect(html).toContain("<delta-cover>");
    // It wasn't renamed to a cover slide. (`cover="true"` still appears in the inlined
    // deck CSS, so assert on the element, not the bare substring.)
    expect(html).not.toContain('<delta-slide cover="true">');
  });

  it("inlines localized strings for the document `lang` as the #delta-i18n island", () => {
    const body = `<title>T</title><section id="s"><title>S</title>text</section>`;
    const pt = compile(`<document lang="pt-BR">${body}</document>`).html;
    expect(pt).toContain('<html lang="pt-BR">');
    expect(pt).toContain('<script type="application/json" id="delta-i18n">');
    expect(pt).toContain('"theorem":"Teorema"');

    const dflt = compile(`<document>${body}</document>`).html;
    expect(dflt).toContain('<html lang="en">');
    expect(dflt).toContain('"theorem":"Theorem"');
  });

  it("passes collapsible/collapsed attributes through to the runtime", () => {
    const { html } = compile(
      `<document><section id="s" collapsible="true"><title>S</title>text
        <proof collapsed="true">trivial</proof>
      </section></document>`,
    );
    expect(html).toContain('<delta-section id="s" collapsible="true"');
    expect(html).toContain('<delta-proof collapsed="true">');
  });

  it("passes <columns>/<column> layout through for the runtime (width preserved)", () => {
    const { html } = compile(
      `<document><title>T</title><section id="s"><title>S</title>
        <columns>
          <column width="2">left</column>
          <column>right</column>
        </columns>
      </section></document>`,
    );
    // Generic rename: the layout rides through as delta-columns/delta-column (no compiler
    // pass), the runtime upgrades it, and the author's width is preserved as an attribute.
    expect(html).toContain("<delta-columns>");
    expect(html).toContain('<delta-column width="2">');
    expect(html).toContain('customElements.define("delta-columns"');
    // The component CSS ships in CORE_CSS, scoped to direct children so it never touches
    // the table's <column> cells (there is no bare `delta-column {` rule).
    expect(html).toContain("delta-columns > delta-column");
  });

  it("passes paper front matter through for the runtime (not numbered)", () => {
    const { html } = compile(
      `<document type="article"><title>T</title>
        <abstract>We prove a thing.</abstract>
        <keywords>spectral theory</keywords>
        <msc>35P15, 47A10</msc>
        <received>2026-01-12</received>
        <section id="s"><title>S</title>text</section>
      </document>`,
    );
    // Generic rename: front-matter tags ride through (no compiler pass) for the runtime
    // to label, and carry no `num` — they aren't environments, so numbering skips them.
    expect(html).toContain("<delta-abstract>");
    expect(html).toContain("<delta-keywords>");
    expect(html).toContain("<delta-msc>");
    expect(html).not.toMatch(/<delta-(abstract|keywords|msc|received)[^>]*\bnum=/);
    expect(html).toContain('customElements.define("delta-abstract"');
    expect(html).toContain("delta-abstract {"); // component CSS shipped in CORE_CSS
  });

  it("references no external resources (the offline invariant)", () => {
    const { html } = compile(DOC);
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) {
      expect(m[1]).toMatch(/^["']?data:/);
    }
  });
});
