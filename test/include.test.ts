import { describe, expect, it } from "vitest";
import { elements, type ElementNode } from "../src/compiler/ast";
import { createContext, type CompileContext } from "../src/compiler/context";
import { resolveIncludes } from "../src/compiler/include";
import { compileSource } from "../src/compiler/index";
import { numberDocument } from "../src/compiler/numbering";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";

// The master file lives in test/fixtures/include/, so `<include src>` resolves there.
const MASTER = "test/fixtures/include/main.dlt";

function merged(src: string): { doc: ElementNode; ctx: CompileContext } {
  const ctx = createContext(MASTER);
  const doc = parse(preprocess(src), ctx);
  if (!doc) throw new Error("parse failed: " + JSON.stringify(ctx.diagnostics));
  resolveIncludes(doc, ctx);
  return { doc, ctx };
}

function tags(doc: ElementNode, tag: string): ElementNode[] {
  const out: ElementNode[] = [];
  for (const el of elements(doc)) if (el.tag === tag) out.push(el);
  return out;
}

describe("resolveIncludes", () => {
  it("splices an included document's children in place of <include>, dropping the wrapper", () => {
    const { doc } = merged(`<document><title>M</title><include src="part.dlt"/></document>`);
    expect(tags(doc, "include")).toHaveLength(0); // resolved away
    expect(tags(doc, "document")).toHaveLength(1); // only the master; the included wrapper is stripped
    // The included section is spliced directly under the master document.
    expect(doc.children.some((c) => c.type === "element" && c.attrs.id === "inc-sec")).toBe(true);
  });

  it("merges into one tree so numbering is continuous across the include", () => {
    const { doc, ctx } = merged(
      `<document><section id="s1"><title>One</title>x</section><include src="part.dlt"/></document>`,
    );
    numberDocument(doc, ctx);
    expect(ctx.registry.get("inc-sec")?.num).toBe("2");
    expect(ctx.registry.get("inc-thm")?.num).toBe("2.1");
  });

  it("resolves nested includes (a file that itself includes another)", () => {
    const { doc } = merged(`<document><include src="nested-outer.dlt"/></document>`);
    expect(tags(doc, "include")).toHaveLength(0);
    expect(tags(doc, "theorem").some((t) => t.attrs.id === "inner-thm")).toBe(true);
    expect(tags(doc, "section").some((s) => s.attrs.id === "outer-sec")).toBe(true);
  });

  it("rewrites a relative asset src from a sub-directory include to be master-relative", () => {
    const { doc } = merged(`<document><include src="sub/fig.dlt"/></document>`);
    expect(tags(doc, "figure")[0]?.attrs.src).toBe("sub/diagram.png");
  });
});

describe("compileSource with includes", () => {
  function compileErr(src: string): { html: string | undefined; ctx: CompileContext } {
    const ctx = createContext(MASTER);
    const html = compileSource(src, ctx);
    return { html, ctx };
  }

  it("fails the build on an include cycle", () => {
    const { html, ctx } = compileErr(`<document><include src="cycle-a.dlt"/></document>`);
    expect(html).toBeUndefined();
    expect(
      ctx.diagnostics.some((d) => d.severity === "error" && /cycle/.test(d.message)),
    ).toBe(true);
  });

  it("fails the build on a missing include", () => {
    const { html, ctx } = compileErr(`<document><include src="does-not-exist.dlt"/></document>`);
    expect(html).toBeUndefined();
    expect(
      ctx.diagnostics.some((d) => d.severity === "error" && /not found/.test(d.message)),
    ).toBe(true);
  });

  it("fails the build on a non-local include src", () => {
    const { html, ctx } = compileErr(`<document><include src="https://x.test/a.dlt"/></document>`);
    expect(html).toBeUndefined();
    expect(
      ctx.diagnostics.some((d) => d.severity === "error" && /local path/.test(d.message)),
    ).toBe(true);
  });

  it("fails the build on a missing target-id", () => {
    const { html, ctx } = compileErr(
      `<document><include src="part.dlt" target-id="does-not-exist"/></document>`,
    );
    expect(html).toBeUndefined();
    expect(
      ctx.diagnostics.some((d) => d.severity === "error" && /target-id not found/.test(d.message)),
    ).toBe(true);
  });

  it("fails the build on a non-unique target-id", () => {
    const { html, ctx } = compileErr(
      `<document><include src="not-unique-id.dlt" target-id="inc-thm"/></document>`,
    );
    expect(html).toBeUndefined();
    expect(
      ctx.diagnostics.some(
        (d) => d.severity === "error" && /Can't resolve include target-id/.test(d.message),
      ),
    ).toBe(true);
  });
});
