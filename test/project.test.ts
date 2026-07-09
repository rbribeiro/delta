import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { compileProject, type ProjectResult } from "../src/compiler/project";

const DIR = "test/fixtures/project";

/** Compile project fixtures (by file name, relative to the fixtures dir). */
function build(names: string[]): ProjectResult {
  return compileProject({ inputs: names.map((n) => resolve(DIR, n)), outDir: "out" });
}

/** The emitted HTML for one output, found by its basename. */
function out(result: ProjectResult, name: string): string {
  const file = result.outputs.find((o) => o.path.endsWith(name));
  if (!file) throw new Error(`no output ${name}; got ${result.outputs.map((o) => o.path)}`);
  return file.html;
}

interface TocEntry {
  level: number;
  id: string;
  num: string;
  title: string;
  file?: string;
}

/** Parse the `#delta-toc` JSON island out of an output's HTML. */
function tocIsland(html: string): TocEntry[] {
  const m = html.match(
    /<script type="application\/json" id="delta-toc">([\s\S]*?)<\/script>/,
  );
  return m ? (JSON.parse(m[1]) as TocEntry[]) : [];
}

const FILES = ["intro.dlt", "chapter1.dlt", "chapter2.dlt"];

describe("compileProject", () => {
  it("produces one output per input and reports no errors", () => {
    const r = build(FILES);
    expect(r.outputs.map((o) => o.path.replace(/.*\//, "")).sort()).toEqual([
      "chapter1.html",
      "chapter2.html",
      "intro.html",
    ]);
    expect(r.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
  });

  it("shares one counter state, so numbering continues across files", () => {
    const r = build(FILES);
    // chapter1 opens section 1; its theorem is 1.1.
    expect(out(r, "chapter1.html")).toContain('id="ch1-sec" num="1"');
    expect(out(r, "chapter1.html")).toContain('id="thm-a" num="1.1"');
    // chapter2 continues at section 2; its theorem is 2.1.
    expect(out(r, "chapter2.html")).toContain('id="ch2-sec" num="2"');
    expect(out(r, "chapter2.html")).toContain('id="thm-b" num="2.1"');
  });

  it("resolves a cross-file <ref> and ships a copy of the target into the output", () => {
    const ch2 = out(build(FILES), "chapter2.html");
    expect(ch2).toContain('data-target-num="1.1"');
    expect(ch2).toContain('data-target-tag="theorem"');
    // The jump navigates to the target's own output file.
    expect(ch2).toContain('data-target-href="chapter1.html#thm-a"');
    // A copy of chapter1's theorem is snapshotted into chapter2 (no fetch).
    expect(ch2).toMatch(/<template data-delta-pop="thm-a"><delta-theorem/);
  });

  it("leaves a same-file <ref> using the in-page jump (no cross-file href)", () => {
    const ch1 = out(build(FILES), "chapter1.html");
    expect(ch1).toContain('data-target-num="1.1"');
    // No <delta-ref> in chapter1 carries a cross-file href (the runtime JS mentions
    // the attribute name, so scope the check to the element).
    expect(ch1).not.toMatch(/<delta-ref[^>]*data-target-href/);
  });

  it("numbers a cross-file <cite> project-wide and snapshots the paper", () => {
    const ch2 = out(build(FILES), "chapter2.html");
    expect(ch2).toContain('data-cite-nums="1"');
    expect(ch2).toContain('data-cite-ids="ARS10"');
    expect(ch2).toContain('data-cite-file="chapter1.html"');
    expect(ch2).toContain('<template data-delta-pop="ARS10">');
  });

  it("renders the project bibliography with only cited papers", () => {
    const ch1 = out(build(FILES), "chapter1.html");
    expect(ch1).toContain('<delta-paper id="ARS10"');
    expect(ch1).not.toContain("KL98"); // loaded but never cited
  });

  it("errors on inputs that collide on a flat output name", () => {
    const dup = compileProject({
      inputs: [resolve(DIR, "chapter1.dlt"), resolve(DIR, "chapter1.dlt")],
      outDir: "out",
    });
    expect(dup.outputs).toHaveLength(0);
    expect(
      dup.diagnostics.some((d) => d.severity === "error" && /duplicate output/.test(d.message)),
    ).toBe(true);
  });

  it("keeps the offline invariant across outputs (no http(s)/link/non-data url)", () => {
    for (const o of build(FILES).outputs) {
      expect(o.html).not.toMatch(/(src|href)\s*=\s*["']https?:/i);
      expect(o.html).not.toMatch(/<link/i);
    }
  });
});

describe("compileProject packages", () => {
  /** A throwaway project: two .dlt inputs + an installed pack under node_modules.
   *  File `b.dlt` also <import>s the pack, to prove the project channel dedups. */
  function tempProject(): string {
    const root = mkdtempSync(join(tmpdir(), "delta-proj-"));
    const pkg = join(root, "node_modules", "delta-proj-pack");
    mkdirSync(pkg, { recursive: true });
    writeFileSync(
      join(pkg, "package.json"),
      JSON.stringify({ name: "delta-proj-pack", delta: { js: "index.js" } }),
    );
    writeFileSync(
      join(pkg, "index.js"),
      `customElements.define("delta-proj-widget", class extends HTMLElement {});`,
    );
    writeFileSync(join(root, "a.dlt"), `<document><title>A</title><section id="a"><title>A</title>x</section></document>`);
    writeFileSync(
      join(root, "b.dlt"),
      `<document><title>B</title><import src="delta-proj-pack" /><section id="b"><title>B</title>y</section></document>`,
    );
    return root;
  }

  it("applies project.toml `packages` to every output, deduping a file's own import", () => {
    const root = tempProject();
    const r = compileProject({
      inputs: [join(root, "a.dlt"), join(root, "b.dlt")],
      outDir: join(root, "out"),
      packages: ["delta-proj-pack"],
      root,
    });
    expect(r.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);

    // Inlined into BOTH outputs from the project channel.
    expect(out(r, "a.html")).toContain("delta-proj-widget");
    const b = out(r, "b.html");
    expect(b).toContain("delta-proj-widget");
    // b also <import>ed it, but the pack JS inlines exactly once.
    expect(b.split('customElements.define("delta-proj-widget"').length - 1).toBe(1);
  });

  it("errors when a project package cannot be resolved", () => {
    const root = mkdtempSync(join(tmpdir(), "delta-proj-"));
    writeFileSync(join(root, "a.dlt"), `<document><title>A</title><section id="a"><title>A</title>x</section></document>`);
    const r = compileProject({
      inputs: [join(root, "a.dlt")],
      outDir: join(root, "out"),
      packages: ["delta-missing-pack"],
      root,
    });
    expect(r.outputs).toHaveLength(0);
    expect(r.diagnostics.some((d) => d.severity === "error" && /not found/.test(d.message))).toBe(true);
  });
});

describe("compileProject document defaults", () => {
  /** Write named `.dlt` files into a fresh temp dir; return the dir and absolute input paths. */
  function docs(files: Record<string, string>): { root: string; inputs: string[] } {
    const root = mkdtempSync(join(tmpdir(), "delta-docdef-"));
    const inputs: string[] = [];
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, name), content);
      inputs.push(join(root, name));
    }
    return { root, inputs };
  }

  /** The `<html …>` open tag of an output. */
  function htmlTag(html: string): string {
    return html.match(/<html[^>]*>/)?.[0] ?? "";
  }

  it("applies theme-accent/theme-mode/lang to a file that declares none", () => {
    const { root, inputs } = docs({
      "a.dlt": `<document><title>A</title><section id="a"><title>A</title>x</section></document>`,
    });
    const r = compileProject({
      inputs,
      outDir: join(root, "out"),
      document: { "theme-accent": "purple", "theme-mode": "dark", lang: "pt" },
    });
    expect(r.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);
    const tag = htmlTag(out(r, "a.html"));
    expect(tag).toContain('lang="pt"');
    expect(tag).toContain('data-accent="purple"');
    expect(tag).toContain('data-mode="dark"');
  });

  it("lets a per-document attribute override the project default", () => {
    const { root, inputs } = docs({
      "own.dlt": `<document lang="en"><title>O</title><section id="o"><title>O</title>x</section></document>`,
      "def.dlt": `<document><title>D</title><section id="d"><title>D</title>y</section></document>`,
    });
    const r = compileProject({ inputs, outDir: join(root, "out"), document: { lang: "pt" } });
    // The file that declared its own lang keeps it; the one that didn't gets the project default.
    expect(htmlTag(out(r, "own.html"))).toContain('lang="en"');
    expect(htmlTag(out(r, "def.html"))).toContain('lang="pt"');
  });

  it("applies a project type before the presentation sugar, expanding <cover>", () => {
    const { root, inputs } = docs({
      "deck.dlt": `<document><cover><title>Talk</title></cover><slide><title>S</title>hi</slide></document>`,
    });
    const r = compileProject({ inputs, outDir: join(root, "out"), document: { type: "presentation" } });
    const html = out(r, "deck.html");
    expect(htmlTag(html)).toContain('data-type="presentation"');
    // Injected before expandCover, so the cover desugared to a slide.
    expect(html).toMatch(/<delta-slide[^>]*cover="true"/);
  });

  it("lets a per-document type override the project type", () => {
    const { root, inputs } = docs({
      "art.dlt": `<document type="article"><cover><title>X</title></cover><section id="s"><title>S</title>z</section></document>`,
    });
    const r = compileProject({ inputs, outDir: join(root, "out"), document: { type: "presentation" } });
    const html = out(r, "art.html");
    expect(htmlTag(html)).not.toContain("data-type"); // article is the default → no attribute
    expect(html).toContain("<delta-cover"); // sugar skipped: <cover> stayed un-desugared
  });

  it("inlines a project default theme into every output", () => {
    const { root, inputs } = docs({
      "a.dlt": `<document><title>A</title><section id="a"><title>A</title>x</section></document>`,
    });
    const themePath = join(root, "book.css");
    writeFileSync(themePath, `.delta-book-marker { color: rebeccapurple; }`);
    const r = compileProject({ inputs, outDir: join(root, "out"), document: { theme: themePath } });
    expect(out(r, "a.html")).toContain(".delta-book-marker");
  });
});

describe("cross-file math ships KaTeX CSS", () => {
  /** Write named `.dlt` files into a fresh temp dir; return the dir and absolute input paths. */
  function docs(files: Record<string, string>): { root: string; inputs: string[] } {
    const root = mkdtempSync(join(tmpdir(), "delta-xmath-"));
    const inputs: string[] = [];
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(join(root, name), content);
      inputs.push(join(root, name));
    }
    return { root, inputs };
  }

  it("includes KaTeX CSS in a math-free file whose project ToC carries heading math", () => {
    const { root, inputs } = docs({
      "index.dlt": `<document><title>Index</title><toc scope="project"/></document>`,
      "chapter.dlt": `<document><title>C</title><section id="how"><title>How to estimate $f$?</title>body</section></document>`,
    });
    const r = compileProject({ inputs, outDir: join(root, "out") });
    expect(r.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);

    const index = out(r, "index.html");
    // The island carries the chapter's rendered heading math…
    const entry = tocIsland(index).find((e) => e.id === "how");
    expect(entry?.title).toContain('class="katex"');
    // …so the KaTeX CSS (which hides .katex-mathml) must ship too.
    expect(index).toContain("KaTeX_Main");
  });

  it("includes KaTeX CSS in a math-free file that snapshots a cross-file math target", () => {
    const { root, inputs } = docs({
      "a.dlt": `<document><title>A</title><section id="a"><title>A</title>See <ref to="thm"/>.</section></document>`,
      "b.dlt": `<document><title>B</title><section id="b"><title>B</title><theorem id="thm">We have $x^2$.</theorem></section></document>`,
    });
    const r = compileProject({ inputs, outDir: join(root, "out") });
    expect(r.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);

    const a = out(r, "a.html");
    expect(a).toMatch(/<template data-delta-pop="thm">[\s\S]*class="katex"/);
    expect(a).toContain("KaTeX_Main");
  });

  it("bakes a cross-file href into an in-math \\ref and snapshots the target", () => {
    const { root, inputs } = docs({
      "a.dlt": `<document><title>A</title><section id="a"><title>A</title>By $x \\stackrel{\\ref{eq:b}}{=} y$.</section></document>`,
      "b.dlt": `<document><title>B</title><section id="b"><title>B</title><equation id="eq:b">a = b</equation></section></document>`,
    });
    const r = compileProject({ inputs, outDir: join(root, "out") });
    expect(r.diagnostics.filter((d) => d.severity === "error")).toHaveLength(0);

    const a = out(r, "a.html");
    expect(a).toContain('data-delta-ref-to="eq:b"');
    expect(a).toContain('data-delta-ref-href="b.html#eq:b"');
    // The sibling file's equation ships as a snapshot (offline popover).
    expect(a).toContain('<template data-delta-pop="eq:b">');
    // The target's own file links in-page — no href on its own math refs.
    expect(out(r, "b.html")).not.toContain("data-delta-ref-href");
  });

  it("still omits KaTeX CSS when neither the file nor its carried content has math", () => {
    const { root, inputs } = docs({
      "index.dlt": `<document><title>Index</title><toc scope="project"/></document>`,
      "chapter.dlt": `<document><title>C</title><section id="plain"><title>Plain</title>body</section></document>`,
    });
    const r = compileProject({ inputs, outDir: join(root, "out") });
    expect(out(r, "index.html")).not.toContain("KaTeX_Main");
  });
});

describe("project table of contents", () => {
  it("ships a book-wide ToC island, tagging other files' entries with their output", () => {
    const toc = tocIsland(out(build(FILES), "chapter1.html"));
    const byId = Object.fromEntries(toc.map((e) => [e.id, e]));

    // chapter1's own heading is left untagged (same-file → in-page jump).
    expect(byId["ch1-sec"]).toBeDefined();
    expect(byId["ch1-sec"].file).toBeUndefined();

    // chapter2's heading is tagged with its home output (cross-file jump).
    expect(byId["ch2-sec"]?.file).toBe("chapter2.html");
  });

  it("slugs an id-less heading in a file that has no <toc> of its own", () => {
    const r = build(FILES);
    const toc = tocIsland(out(r, "chapter1.html"));
    const deeper = toc.find((e) => e.title === "Deeper");
    expect(deeper).toBeDefined();
    expect(deeper!.id).toBe("deeper");
    expect(deeper!.file).toBe("chapter2.html");
    // The generated id is a real anchor in chapter2's own output.
    expect(out(r, "chapter2.html")).toMatch(/<delta-subsection[^>]*id="deeper"/);
  });

  it("only the file with a <toc> ships an island", () => {
    const r = build(FILES);
    expect(out(r, "chapter1.html")).toContain('id="delta-toc"');
    expect(out(r, "chapter2.html")).not.toContain('id="delta-toc"');
    expect(out(r, "intro.html")).not.toContain('id="delta-toc"');
  });
});
