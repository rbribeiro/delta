import { describe, expect, it } from "vitest";
import type { ElementNode } from "../src/compiler/ast";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";
import { resolveTheme } from "../src/compiler/theme";
import { THEMES } from "../src/generated/assets";

// ctx.file lives in test/, so a `theme` path resolves relative to test/.
function resolved(src: string): { doc: ElementNode; ctx: CompileContext } {
  const ctx = createContext("test/doc.dlt");
  const doc = parse(preprocess(src), ctx);
  if (!doc) throw new Error("parse failed: " + JSON.stringify(ctx.diagnostics));
  resolveTheme(doc, ctx);
  return { doc, ctx };
}

function compile(src: string): string {
  const ctx = createContext("test/doc.dlt");
  const html = compileSource(src, ctx);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return html;
}

describe("resolveTheme", () => {
  it("reads a local theme file into ctx.userCss without diagnostics", () => {
    const { ctx } = resolved(`<document theme="fixtures/theme.css"></document>`);
    expect(ctx.userCss).toContain("--delta-accent: #c0392b");
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("leaves ctx.userCss undefined when there is no theme attribute", () => {
    const { ctx } = resolved(`<document></document>`);
    expect(ctx.userCss).toBeUndefined();
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("warns and skips a missing theme file", () => {
    const { ctx } = resolved(`<document theme="fixtures/nope.css"></document>`);
    expect(ctx.userCss).toBeUndefined();
    expect(
      ctx.diagnostics.some((d) => d.severity === "warning" && d.message.includes("nope.css")),
    ).toBe(true);
  });

  it("warns and skips a remote theme URL (keeps the output offline)", () => {
    const { ctx } = resolved(`<document theme="https://x.test/a.css"></document>`);
    expect(ctx.userCss).toBeUndefined();
    expect(ctx.diagnostics.some((d) => d.severity === "warning")).toBe(true);
  });

  it("warns about an external reference inside the theme but still inlines it", () => {
    const { ctx } = resolved(`<document theme="fixtures/theme-remote.css"></document>`);
    expect(ctx.userCss).toContain("@import");
    expect(
      ctx.diagnostics.some(
        (d) => d.severity === "warning" && /external resource/.test(d.message),
      ),
    ).toBe(true);
  });
});

describe("emit with a theme", () => {
  const body = `<title>T</title><section id="s"><title>S</title>text</section>`;

  it("inlines the author theme as the last <style> block, after the type theme", () => {
    const html = compile(`<document theme="fixtures/theme.css">${body}</document>`);
    expect(html).toContain("--delta-accent: #c0392b");
    // The user block wins by coming after the @layer delta.theme overrides…
    expect(html.indexOf("#c0392b")).toBeGreaterThan(html.indexOf(THEMES.article));
    // …and it is the final stylesheet in <head>.
    const lastStyle = html.slice(html.lastIndexOf("<style>"), html.lastIndexOf("</style>"));
    expect(lastStyle).toContain("#c0392b");
  });

  it("emits no extra <style> when there is no theme", () => {
    const html = compile(`<document>${body}</document>`);
    expect(html).not.toContain("#c0392b");
  });

  it("keeps the offline invariant for a clean theme", () => {
    const html = compile(`<document theme="fixtures/theme.css">${body}</document>`);
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) {
      expect(m[1]).toMatch(/^["']?data:/);
    }
  });
});
