import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "./harness.ts";
import type { ElementNode } from "../src/compiler/ast.ts";
import { createContext, type CompileContext } from "../src/compiler/context.ts";
import { resolveImports, standardPacksFor } from "../src/compiler/imports.ts";
import { parsePreprocessed } from "../src/compiler/parse.ts";
import { preprocess } from "../src/compiler/preprocess.ts";
import { THEMES } from "../src/generated/assets.ts";
import { compileFiles, compileHtml, parsed } from "./helpers.ts";

const compile = (src: string): string => compileHtml(src, { file: "test/doc.dlt" });

// ctx.file lives in test/, so an `import` src resolves relative to test/.
function resolved(src: string): { doc: ElementNode; ctx: CompileContext } {
  const { doc, ctx } = parsed(src, "test/doc.dlt");
  resolveImports(doc, ctx);
  return { doc, ctx };
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

  it("reads a delta manifest: uses the declared js/css, records tags and the npm name", () => {
    const { ctx } = resolved(`<document><import src="fixtures/manifest-pack" /></document>`);
    expect(ctx.imports).toHaveLength(1);
    expect(ctx.imports[0].js).toContain("delta-widget"); // browser.js, not index.js
    expect(ctx.imports[0].css).toContain("#123456"); // pack.css, not theme.css
    expect(ctx.imports[0].tags).toEqual(["widget"]);
    expect(ctx.imports[0].name).toBe("delta-manifest-pack");
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("inlines a pack's `needs` dependency-first", () => {
    const { ctx } = resolved(`<document><import src="fixtures/needs-pack" /></document>`);
    expect(ctx.imports).toHaveLength(2);
    // the dependency (manifest-pack) inlines before the dependent (needs-pack)
    expect(ctx.imports[0].js).toContain("delta-widget");
    expect(ctx.imports[1].js).toContain("delta-needy");
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("inlines a library two packs need once, without an 'already imported' warning", () => {
    const { ctx } = resolved(
      `<document><import src="fixtures/needs-pack" /><import src="fixtures/needs-pack-2" /></document>`,
    );
    expect(ctx.imports.filter((i) => i.js.includes("delta-widget"))).toHaveLength(1);
    expect(ctx.diagnostics).toHaveLength(0);
  });

  it("resolves a bare specifier from node_modules", () => {
    // Build a throwaway project dir with the package installed under node_modules.
    const root = mkdtempSync(join(tmpdir(), "delta-pack-"));
    const pkg = join(root, "node_modules", "delta-temp-pack");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({ name: "delta-temp-pack", delta: { js: "index.js" } }),
    );
    writeFileSync(
      join(pkg, "index.js"),
      `customElements.define("delta-temp", class extends HTMLElement {});`,
    );

    const ctx = createContext(join(root, "doc.dlt"));
    const doc = parsePreprocessed(
      preprocess(`<document><import src="delta-temp-pack" /></document>`),
      ctx,
    );
    if (!doc) throw new Error("parse failed");
    resolveImports(doc, ctx);
    expect(ctx.diagnostics).toHaveLength(0);
    expect(ctx.imports).toHaveLength(1);
    expect(ctx.imports[0].js).toContain("delta-temp");
    expect(ctx.imports[0].name).toBe("delta-temp-pack");
  });

  it("errors a bare specifier that is not installed", () => {
    const { ctx } = resolved(`<document><import src="delta-not-installed" /></document>`);
    expect(ctx.imports).toHaveLength(0);
    expect(ctx.diagnostics.some((d) => d.severity === "error" && /not found/.test(d.message))).toBe(
      true,
    );
  });

  it("warns about external references inside a pack but still inlines it", () => {
    const { ctx } = resolved(`<document><import src="fixtures/pack-remote" /></document>`);
    expect(ctx.imports).toHaveLength(1);
    expect(
      ctx.diagnostics.filter((d) => d.severity === "warning" && /external resource/.test(d.message))
        .length,
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

describe("standardPacksFor", () => {
  const table = {
    plot: {
      js: `customElements.define("delta-plot", class {})`,
      css: "delta-plot{}",
      tags: ["plot"],
    },
    quiz: { js: `customElements.define("delta-quiz", class {})`, tags: ["quiz"] },
  };
  const own = (js: string) => ({ source: "/own/index.js", js });

  it("returns the packs whose tags are used, as delta:<name> entries", () => {
    const packs = standardPacksFor(new Set(["p", "plot"]), [], table);
    expect(packs.map((p) => p.source)).toEqual(["delta:plot"]);
    expect(packs[0]).toMatchObject({ name: "delta:plot", css: "delta-plot{}", tags: ["plot"] });
  });

  it("returns nothing when no pack tag is used", () => {
    expect(standardPacksFor(new Set(["p", "theorem"]), [], table)).toEqual([]);
  });

  it("skips a pack whose tag an explicit pack already registers", () => {
    const explicit = [own(`customElements.define( 'delta-plot' , X)`)];
    const packs = standardPacksFor(new Set(["plot", "quiz"]), explicit, table);
    expect(packs.map((p) => p.source)).toEqual(["delta:quiz"]);
  });
});

describe("emit with a standard pack", () => {
  const doc = (body: string, head = "") =>
    `<document>${head}<title>T</title><section id="s"><title>S</title>${body}</section></document>`;

  it("inlines the pack's JS and CSS when its tag is used", () => {
    const html = compile(doc(`<pack-example>Hi</pack-example>`));
    expect(html.match(/\/\* pack: delta:example \*\//g)).toHaveLength(1);
    expect(html).toContain('customElements.define("delta-pack-example"');
    expect(html).toContain("delta-pack-example .pack-example-label");
  });

  it("inlines nothing when the tag is not used", () => {
    const html = compile(doc(`text`));
    expect(html).not.toContain("delta:example");
    expect(html).not.toContain("delta-pack-example");
  });

  it("puts standard packs after the author's packs, and their CSS before the author theme", () => {
    const html = compile(
      doc(`<pack-example>Hi</pack-example>`, `<import src="fixtures/pack" />`).replace(
        "<document>",
        `<document theme="fixtures/theme.css">`,
      ),
    );
    expect(html.indexOf("/* pack: delta:example */")).toBeGreaterThan(
      html.indexOf("/* pack: pack */"),
    );
    const css = html.indexOf("delta-pack-example .pack-example-label");
    expect(css).toBeGreaterThan(html.indexOf("#abcdef")); // the author's pack CSS
    expect(css).toBeLessThan(html.indexOf("#c0392b")); // the author theme
  });

  it("leaves the tag to an explicit pack that registers it", () => {
    const html = compile(
      doc(`<pack-example>Hi</pack-example>`, `<import src="fixtures/own-example" />`),
    );
    expect(html).toContain("/* pack: own-example */");
    expect(html).not.toContain("delta:example");
  });

  it("loads the pack for a tag that only arrives in another file's pop-over snapshot", () => {
    const r = compileFiles({
      "a.dlt": `<document><title>A</title><p>See <ref to="thm:x" />.</p></document>`,
      "b.dlt": `<document><title>B</title><theorem id="thm:x"><pack-example>Hi</pack-example></theorem></document>`,
    });
    const a = r.html("a.html");
    expect(a).toContain('<template data-delta-pop="thm:x">');
    // The tag is nowhere in a.html's own body: only inside the snapshot of b.dlt's theorem.
    const ownBody = a.slice(a.indexOf("<body>"), a.indexOf("<template"));
    expect(ownBody).not.toContain("<delta-pack-example");
    expect(a.match(/\/\* pack: delta:example \*\//g)).toHaveLength(1);
  });

  it("keeps the offline invariant", () => {
    const html = compile(doc(`<pack-example>Hi</pack-example>`));
    expect(html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
    expect(html).not.toMatch(/<link/i);
    for (const m of html.matchAll(/url\(\s*([^)]*)\)/g)) expect(m[1]).toMatch(/^["']?data:/);
  });
});

describe("pack strings", () => {
  /** The `#delta-i18n` island of a compiled page, parsed. */
  const island = (html: string): Record<string, string> =>
    JSON.parse(/<script type="application\/json" id="delta-i18n">(.*?)<\/script>/.exec(html)![1]);
  const doc = (lang: string, head: string, body: string) =>
    `<document lang="${lang}">${head}<title>T</title>${body}</document>`;

  it("merges a pack's strings for the document's language (English underneath)", () => {
    const pack = `<import src="fixtures/strings-pack" />`;
    expect(island(compile(doc("en", pack, "x")))["greeting.hello"]).toBe("Hello");
    expect(island(compile(doc("pt-BR", pack, "x")))["greeting.hello"]).toBe("Olá");
    expect(island(compile(doc("fr", pack, "x")))["greeting.hello"]).toBe("Hello");
  });

  it("lets a core key win over a pack's", () => {
    const html = compile(doc("en", `<import src="fixtures/strings-pack" />`, "x"));
    expect(island(html).theorem).toBe("Theorem");
  });

  it("switches a standard pack's label with the language", () => {
    const body = `<pack-example>Hi</pack-example>`;
    expect(island(compile(doc("en", "", body)))["example.label"]).toBe("Example pack");
    expect(island(compile(doc("pt-BR", "", body)))["example.label"]).toBe("Pacote de exemplo");
  });

  it("leaves the island byte-identical when no pack has strings", () => {
    const i18n = (html: string) =>
      /<script type="application\/json" id="delta-i18n">.*?<\/script>/.exec(html)![0];
    const without = compile(doc("pt-BR", "", "x"));
    const withPack = compile(doc("pt-BR", `<import src="fixtures/pack" />`, "x"));
    expect(i18n(withPack)).toBe(i18n(without));
  });

  it("warns when the manifest names a strings file that is missing", () => {
    const { ctx } = resolved(`<document><import src="fixtures/bad-strings-pack" /></document>`);
    expect(ctx.imports).toHaveLength(1);
    expect(ctx.diagnostics.map((d) => d.message)).toEqual([
      "import 'fixtures/bad-strings-pack' declares strings 'missing.json' but it was not found",
    ]);
  });
});
