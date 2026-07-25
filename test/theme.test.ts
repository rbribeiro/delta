import { describe, expect, it } from "vitest";
import type { ElementNode } from "../src/compiler/ast";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";
import { isBuiltinThemeName, resolveTheme } from "../src/compiler/theme";
import { BUILTIN_THEMES, CORE_CSS, THEMES } from "../src/generated/assets";

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

describe("built-in themes", () => {
  it("resolves a bare name into ctx.builtinCss, not ctx.userCss", () => {
    const { ctx } = resolved(`<document theme="impatech"></document>`);
    expect(ctx.builtinCss).toContain("--delta-lime");
    expect(ctx.userCss).toBeUndefined();
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("registers no --watch dependency for a built-in (it ships inside the compiler)", () => {
    const { ctx } = resolved(`<document theme="impatech"></document>`);
    expect(ctx.deps.size).toBe(0);
  });

  it("warns with the available list when the built-in name is unknown", () => {
    const { ctx } = resolved(`<document theme="nosuchtheme"></document>`);
    expect(ctx.builtinCss).toBeUndefined();
    const warning = ctx.diagnostics.find((d) => /unknown built-in theme/.test(d.message));
    expect(warning?.severity).toBe("warning");
    expect(warning?.message).toContain("impatech"); // names the themes that do exist
  });

  it("never retries a bare name as a path, even when that file exists", () => {
    // test/fixtures/impatek is a real, extension-less CSS file sitting right where
    // a path lookup would find it. Resolution must not depend on the filesystem.
    const ctx = createContext("test/fixtures/doc.dlt");
    const doc = parse(preprocess(`<document theme="impatek"></document>`), ctx);
    resolveTheme(doc!, ctx);
    expect(ctx.userCss).toBeUndefined();
    expect(ctx.builtinCss).toBeUndefined();
    expect(ctx.diagnostics.some((d) => /unknown built-in theme/.test(d.message))).toBe(true);
  });

  it("still reports a missing *path* as a missing file, not an unknown built-in", () => {
    const { ctx } = resolved(`<document theme="fixtures/nope.css"></document>`);
    expect(ctx.diagnostics.some((d) => /theme file not found/.test(d.message))).toBe(true);
    expect(ctx.diagnostics.some((d) => /unknown built-in theme/.test(d.message))).toBe(false);
  });

  it("hints at the built-in when the author writes the name with a .css extension", () => {
    const { ctx } = resolved(`<document theme="impatech.css"></document>`);
    expect(ctx.diagnostics.some((d) => /did you mean the built-in theme 'impatech'/.test(d.message)))
      .toBe(true);
  });

  it("tells names from paths by shape alone", () => {
    for (const name of ["impatech", "my-theme", "Impatech", "a"]) {
      expect(isBuiltinThemeName(name), name).toBe(true);
    }
    for (const path of [
      "theme.css", "./x.css", "../shared/x.css", "/abs/x.css",
      "C:\\x.css", "a/b", "https://x.test/a.css", "impatech.css",
    ]) {
      expect(isBuiltinThemeName(path), path).toBe(false);
    }
  });

  it("inlines the built-in before the type theme, and leaves the author slot last", () => {
    const body = `<title>T</title><section id="s"><title>S</title>text</section>`;
    const html = compile(`<document theme="impatech">${body}</document>`);
    expect(html.indexOf(BUILTIN_THEMES.impatech)).toBeGreaterThan(-1);
    expect(html.indexOf(BUILTIN_THEMES.impatech)).toBeLessThan(html.indexOf(THEMES.article));
    // No author theme, so the built-in must not have landed in the last (unlayered) slot.
    const lastStyle = html.slice(html.lastIndexOf("<style>"));
    expect(lastStyle).not.toContain("--delta-lime");
  });

  it("keeps <html> bare for a built-in (no data-theme hook)", () => {
    const body = `<title>T</title><section id="s"><title>S</title>text</section>`;
    const html = compile(`<document theme="impatech">${body}</document>`);
    expect(html).toContain(`<html lang="en">`);
  });

  it("keeps the offline invariant", () => {
    const body = `<title>T</title><section id="s"><title>S</title>text</section>`;
    const html = compile(`<document theme="impatech">${body}</document>`);
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) expect(m[1]).toMatch(/^["']?data:/);
  });

  // The tokens-only rule is what lets a theme be a pure re-valuing of the design
  // system — enforced here rather than left to reviewer discipline.
  it.each(Object.keys(BUILTIN_THEMES))("%s sets tokens and nothing else", (name) => {
    const css = BUILTIN_THEMES[name].replace(/\/\*[\s\S]*?\*\//g, "");
    expect(css.trim()).toMatch(/^@layer delta\.builtin\s*\{\s*:root\s*\{/);
    expect(css.match(/\{/g)).toHaveLength(2); // the @layer and the :root — no selectors
    expect(css).not.toMatch(/@import|url\(/);
    for (const decl of css.matchAll(/([\w-]+)\s*:/g)) {
      expect(decl[1].startsWith("--delta-"), `${name} declares ${decl[1]}`).toBe(true);
    }
  });
});

describe("base.css invariants", () => {
  // The two blocks are duplicated by hand (no build-time preprocessing), so they
  // can drift. They are the reason dark mode works at all — keep them identical.
  it("keeps the [data-mode] dark and auto declaration lists in sync", () => {
    // Comments are stripped first: base.css's own commentary mentions both
    // selectors by name, and matching one of those would silently compare a block
    // with itself — a test that can never fail.
    const css = CORE_CSS.replace(/\/\*[\s\S]*?\*\//g, "");
    // Brace-count to the matching close: the `auto` block is nested inside an
    // @media rule, so the two don't end at the same indent.
    const declarations = (selector: string): string[] => {
      const at = css.indexOf(selector);
      expect(at, `${selector} not found in CORE_CSS`).toBeGreaterThan(-1);
      let depth = 0;
      let start = -1;
      let i = at;
      for (; i < css.length; i++) {
        if (css[i] === "{") {
          if (depth === 0) start = i + 1;
          depth++;
        } else if (css[i] === "}" && --depth === 0) break;
      }
      return css.slice(start, i)
        .split(";")
        .map((d) => d.trim().replace(/\s+/g, " ")) // continuation lines are indented differently
        .filter(Boolean);
    };
    expect(declarations(`[data-mode="dark"]`)).toEqual(declarations(`[data-mode="auto"]`));
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
