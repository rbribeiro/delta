import { describe, expect, it } from "vitest";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";

function compile(src: string): { html: string; ctx: CompileContext } {
  const ctx = createContext("test.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

const DOC = `<document>
  <section id="s"><title>S</title>
    <equation id="eq:a">a^2 + b^2 = c^2</equation>
    In prose: $x \\stackrel{\\ref{eq:a}}{=} y$.
  </section>
</document>`;

describe("\\ref inside math", () => {
  it("resolves the target and bakes the link marker into the KaTeX output", () => {
    const { html, ctx } = compile(DOC);
    expect(html).toContain('data-delta-ref-to="eq:a"');
    expect(html).toContain('data-delta-ref-num="1.1"'); // section-prefixed, like <ref>
    expect(html).toContain('data-delta-ref-tag="equation"');
    // The target is snapshotted for the popover, like a <ref>.
    expect(html).toContain('<template data-delta-pop="eq:a">');
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("renders \\eqref with the parenthesized number", () => {
    const { html } = compile(`<document><section id="s"><title>S</title>
      <equation id="eq:a">a = b</equation>
      $\\eqref{eq:a}$
    </section></document>`);
    // KaTeX renders \text{(1.1)} as one contiguous .mord string.
    expect(html).toContain('data-delta-ref-to="eq:a"');
    expect(html).toContain("(1.1)");
  });

  it("warns and renders ?? for an unresolved id", () => {
    const { html, ctx } = compile(
      `<document><section id="s"><title>S</title>$\\ref{ghost}$</section></document>`,
    );
    expect(
      ctx.diagnostics.some(
        (d) => d.severity === "warning" && d.message.includes("Unresolved reference ghost"),
      ),
    ).toBe(true);
    expect(html).toContain("??");
    expect(html).not.toContain('data-delta-pop="'); // (bare name appears in the runtime JS)
  });

  it("leaves \\ref literal outside math regions", () => {
    const { html } = compile(
      `<document><section id="s"><title>S</title><code>\\ref{eq:a}</code></section></document>`,
    );
    // The runtime JS mentions the attribute name in a selector; check for an
    // actual attribute occurrence instead.
    expect(html).not.toContain('data-delta-ref-to="');
  });

  it("keeps the offline invariant", () => {
    const { html } = compile(DOC);
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
  });
});
