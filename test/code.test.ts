import { describe, expect, it } from "vitest";
import { createContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";

function compile(src: string) {
  const ctx = createContext("test.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

const doc = (body: string) =>
  `<document lang="en"><title>T</title><section id="s"><title>S</title>${body}</section></document>`;

describe("code", () => {
  it("highlights a <code> block with the given language", () => {
    const { html } = compile(doc(`<code lang="javascript">const x = 1;</code>`));
    expect(html).toContain('<delta-code lang="javascript">');
    expect(html).toContain('class="hljs-keyword"'); // `const`
    expect(html).toContain("const"); // source text survives
  });

  it("warns and falls back to escaped plain text on an unknown language", () => {
    // inside a raw tag, authors write literal `<` — never an entity
    const { html, ctx } = compile(doc(`<code lang="klingon">a < b</code>`));
    expect(ctx.diagnostics.some((d) => /unknown language/.test(d.message))).toBe(true);
    expect(html).not.toContain('class="hljs-'); // no highlighted spans (the CSS map always has .hljs-*)
    expect(html).toContain("a &lt; b"); // escaped in output, not re-highlighted
  });

  it("renders a <code> block without a lang as escaped plain text", () => {
    const { html } = compile(doc(`<code>1 < 2 && 3 > 2</code>`));
    expect(html).not.toContain('class="hljs-'); // no highlighted spans (the CSS map always has .hljs-*)
    expect(html).toContain("1 &lt; 2 &amp;&amp; 3 &gt; 2");
  });

  it("strips common indentation and surrounding blank lines (dedent)", () => {
    const { html } = compile(
      doc(`<code>\n      a\n        b\n      c\n    </code>`),
    );
    // common indent (6 spaces) removed; inner relative indent kept
    expect(html).toContain("<delta-code>a\n  b\nc</delta-code>");
  });

  it("leaves inline <c> literal and unhighlighted", () => {
    const { html } = compile(doc(`Run <c>a < b & c</c> now.`));
    expect(html).toContain("<delta-c>a &lt; b &amp; c</delta-c>");
    expect(html).not.toContain('class="hljs-'); // no highlighted spans (the CSS map always has .hljs-*)
  });

  it("keeps the offline invariant with a code block (no external refs)", () => {
    const { html } = compile(doc(`<code lang="python">import os</code>`));
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) {
      expect(m[1]).toMatch(/^["']?data:/);
    }
  });
});
