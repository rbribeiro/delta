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

  it("references no external resources (the offline invariant)", () => {
    const { html } = compile(DOC);
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) {
      expect(m[1]).toMatch(/^["']?data:/);
    }
  });
});
