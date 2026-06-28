import { describe, expect, it } from "vitest";
import type { ElementNode } from "../src/compiler/ast";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { resolveImports } from "../src/compiler/imports";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";
import { THEMES } from "../src/generated/assets";

// ctx.file lives in test/, so an `import` src resolves relative to test/.
function resolved(src: string): { doc: ElementNode; ctx: CompileContext } {
  const ctx = createContext("test/doc.dlt");
  const doc = parse(preprocess(src), ctx);
  if (!doc) throw new Error("parse failed: " + JSON.stringify(ctx.diagnostics));
  resolveImports(doc, ctx);
  return { doc, ctx };
}

function compile(src: string): string {
  const ctx = createContext("test/doc.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return html;
}

const hasImportNode = (doc: ElementNode) =>
  doc.children.some((c) => c.type === "element" && c.tag === "import");

describe("resolveImports", () => {
  it("reads a pack's index.js and theme.css into ctx.imports without diagnostics", () => {
    const { ctx } = resolved(`<document><import src="fixtures/pack" /></document>`);
    expect(ctx.imports).toHaveLength(1);
    expect(ctx.imports[0].js).toContain("delta-fixture");
    expect(ctx.imports[0].css).toContain("#abcdef");
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("leaves css undefined for a pack without theme.css (no warning)", () => {
    const { ctx } = resolved(`<document><import src="fixtures/pack-nocss" /></document>`);
    expect(ctx.imports).toHaveLength(1);
    expect(ctx.imports[0].js).toContain("delta-nocss");
    expect(ctx.imports[0].css).toBeUndefined();
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("strips every <import> node from the document", () => {
    const { doc } = resolved(`<document><import src="fixtures/pack" /></document>`);
    expect(hasImportNode(doc)).toBe(false);
  });

  it("errors a pack whose index.js is missing (still strips the node)", () => {
    const { doc, ctx } = resolved(`<document><import src="fixtures/nope" /></document>`);
    expect(ctx.imports).toHaveLength(0);
    expect(hasImportNode(doc)).toBe(false);
    expect(
      ctx.diagnostics.some((d) => d.severity === "error" && d.message.includes("not found")),
    ).toBe(true);
  });

  it("warns on an <import> without a src", () => {
    const { ctx } = resolved(`<document><import /></document>`);
    expect(ctx.imports).toHaveLength(0);
    expect(ctx.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("warns and skips a remote import URL (keeps the output offline)", () => {
    const { ctx } = resolved(`<document><import src="https://x.test/pack" /></document>`);
    expect(ctx.imports).toHaveLength(0);
    expect(ctx.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("inlines the same pack only once (dedup by path)", () => {
    const { ctx } = resolved(
      `<document><import src="fixtures/pack" /><import src="fixtures/pack" /></document>`,
    );
    expect(ctx.imports).toHaveLength(1);
  });

  it("warns about external references inside a pack but still inlines it", () => {
    const { ctx } = resolved(`<document><import src="fixtures/pack-remote" /></document>`);
    expect(ctx.imports).toHaveLength(1);
    expect(
      ctx.diagnostics.filter(
        (d) => d.severity === "warning" && /external resource/.test(d.message),
      ).length,
    ).toBeGreaterThanOrEqual(1);
  });
});

describe("emit with an import", () => {
  const body = `<title>T</title><section id="s"><title>S</title>text</section>`;

  it("inlines the pack JS in a <script> after the runtime", () => {
    const html = compile(`<document><import src="fixtures/pack" />${body}</document>`);
    expect(html).toContain('customElements.define("delta-fixture"');
    // The pack <script> carries a `/* pack: <folder> */` marker and is emitted after
    // the runtime (which is the only place `window.Delta` is assigned).
    expect(html).toContain("/* pack: pack */");
    expect(html.indexOf("/* pack: pack */")).toBeGreaterThan(html.indexOf("window.Delta"));
  });

  it("inlines the pack CSS after the type theme and before the author theme", () => {
    const html = compile(
      `<document theme="fixtures/theme.css"><import src="fixtures/pack" />${body}</document>`,
    );
    expect(html).toContain("#abcdef");
    expect(html.indexOf("#abcdef")).toBeGreaterThan(html.indexOf(THEMES.article));
    expect(html.indexOf("#abcdef")).toBeLessThan(html.indexOf("#c0392b"));
  });

  it("never serializes an <import> as <delta-import>", () => {
    const html = compile(`<document><import src="fixtures/pack" />${body}</document>`);
    expect(html).not.toContain("delta-import");
  });

  it("keeps the offline invariant for an imported pack", () => {
    const html = compile(`<document><import src="fixtures/pack" />${body}</document>`);
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) {
      expect(m[1]).toMatch(/^["']?data:/);
    }
  });
});
