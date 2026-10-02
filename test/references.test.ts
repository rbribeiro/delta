import { describe, expect, it } from "vitest";
import { elements, type ElementNode } from "../src/compiler/ast";
import { type CompileContext } from "../src/compiler/context";
import { numberDocument } from "../src/compiler/numbering";
import { resolveReferences } from "../src/compiler/references";
import { compileHtml, parsed } from "./helpers";

function resolved(src: string): { ref?: ElementNode; ctx: CompileContext } {
  const { doc, ctx } = parsed(src);
  numberDocument(doc, ctx);
  resolveReferences(doc, ctx);
  let ref: ElementNode | undefined;
  for (const el of elements(doc)) if (el.tag === "ref") ref = el;
  return { ref, ctx };
}

const DOC = `<document>
  <section id="s"><title>S</title>
    <theorem id="t"><title>Pyth</title>body</theorem>
    See <ref to="t"/> above.
  </section>
</document>`;

describe("resolveReferences", () => {
  it("writes the target's number and kind onto a resolved ref", () => {
    const { ref, ctx } = resolved(DOC);
    expect(ref?.attrs["data-target-num"]).toBe("1.1");
    expect(ref?.attrs["data-target-tag"]).toBe("theorem");
    expect(ctx.referencedIds.has("t")).toBe(true);
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("warns and leaves the node bare for an unresolved target", () => {
    const { ref, ctx } = resolved(
      `<document><section id="s"><title>S</title><ref to="ghost"/></section></document>`,
    );
    expect(ref?.attrs["data-target-num"]).toBeUndefined();
    expect(ref?.attrs["data-target-tag"]).toBeUndefined();
    expect(ctx.referencedIds.size).toBe(0);
    expect(
      ctx.diagnostics.some((d) => d.severity === "warning" && d.message.includes("ghost")),
    ).toBe(true);
  });

  it("warns about a <ref> with no 'to'", () => {
    const { ctx } = resolved(
      `<document><section id="s"><title>S</title><ref/></section></document>`,
    );
    expect(ctx.diagnostics.some((d) => d.severity === "warning" && /to/.test(d.message))).toBe(true);
  });
});

describe("emit with references", () => {
  it("ships resolved data on the ref and snapshots the target into a <template>", () => {
    const html = compileHtml(DOC);
    expect(html).toContain('data-target-num="1.1"');
    expect(html).toContain('data-target-tag="theorem"');
    expect(html).toContain('<template data-delta-pop="t">');
    // The snapshot is the target's own delta-* HTML (cloned client-side, no fetch).
    expect(html).toMatch(/<template data-delta-pop="t"><delta-theorem/);
  });

  it("snapshots only referenced targets", () => {
    const html = compileHtml(`<document><section id="s"><title>S</title>
      <theorem id="t"><title>A</title>x</theorem>
      <theorem id="u"><title>B</title>y</theorem>
      See <ref to="t"/>.
    </section></document>`);
    expect(html).toContain('data-delta-pop="t"');
    expect(html).not.toContain('data-delta-pop="u"');
  });

  it("keeps the offline invariant", () => {
    const html = compileHtml(DOC);
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) {
      expect(m[1]).toMatch(/^["']?data:/);
    }
  });
});
