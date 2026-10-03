import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "./harness.ts";
import { elements, type ElementNode } from "../src/compiler/ast.ts";
import { createContext, type CompileContext } from "../src/compiler/context.ts";
import { inlineFigures } from "../src/compiler/figures.ts";
import { compileSource } from "../src/compiler/index.ts";
import { parsed } from "./helpers.ts";

// ctx.file lives in test/, so a figure `src` resolves relative to test/.
function inlined(src: string): { doc: ElementNode; ctx: CompileContext } {
  const { doc, ctx } = parsed(src, "test/doc.dlt");
  inlineFigures(doc, ctx);
  return { doc, ctx };
}

function figureSrc(doc: ElementNode): string | undefined {
  for (const el of elements(doc)) if (el.tag === "figure") return el.attrs.src;
  return undefined;
}

describe("inlineFigures", () => {
  it("embeds a local image as a base64 data: URI", () => {
    const { doc, ctx } = inlined(`<document><figure src="fixtures/dot.svg"/></document>`);
    const b64 = readFileSync(resolve("test/fixtures/dot.svg")).toString("base64");
    expect(figureSrc(doc)).toBe(`data:image/svg+xml;base64,${b64}`);
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("warns and drops the src when the image is missing", () => {
    const { doc, ctx } = inlined(`<document><figure src="fixtures/nope.png"/></document>`);
    expect(figureSrc(doc)).toBeUndefined();
    expect(
      ctx.diagnostics.some((d) => d.severity === "warning" && d.message.includes("nope.png")),
    ).toBe(true);
  });

  it("warns and drops a remote src (keeps the output offline)", () => {
    const { doc, ctx } = inlined(`<document><figure src="https://x.test/a.png"/></document>`);
    expect(figureSrc(doc)).toBeUndefined();
    expect(ctx.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("stays self-contained end-to-end (data: URI, no relative/http src)", () => {
    const ctx = createContext("test/doc.dlt");
    const html = compileSource(
      `<document><figure src="fixtures/dot.svg"><caption>A dot.</caption></figure></document>`,
      ctx,
    );
    expect(html).toContain("data:image/svg+xml;base64,");
    expect(html).not.toMatch(/src="fixtures\//);
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
  });
});
