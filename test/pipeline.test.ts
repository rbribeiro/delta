import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { compileFile, type CompileOptions, type TraceEvent } from "../src/compiler/index";
import { PIPELINE } from "../src/compiler/pipeline";
import { compileProject } from "../src/compiler/project";

/** Writes each source into a fresh temp dir and returns its absolute paths. */
function scratch(files: Record<string, string>): { dir: string; paths: string[] } {
  const dir = mkdtempSync(join(tmpdir(), "delta-pipeline-"));
  const paths = Object.entries(files).map(([name, src]) => {
    const p = join(dir, name);
    writeFileSync(p, src);
    return p;
  });
  return { dir, paths };
}

const MATH_AND_REFS = `<document lang="en">
  <title>T</title>
  <toc/>
  <section id="s"><title>Warm-up $x$</title>
    Text $a < b$ and <ref to="thm"/> and <cite paper="p1"/>.
    <theorem id="thm"><title>A</title>$$e = mc^2$$ see \\eqref{eq}</theorem>
    <equation id="eq">y</equation>
    <code lang="python">print(1)</code>
    <proof of="thm">done</proof>
  </section>
  <bibliography><paper id="p1"><title>Paper</title><author>Someone</author></paper></bibliography>
</document>`;

const PROJECT_SCOPED = `<document lang="pt-BR" theme-accent="blue">
  <team><member id="ai" name="Claude" kind="agent"/></team>
  <floating><title>Nav</title><toc scope="project"/></floating>
  <review scope="project"/>
  <section><title>Sem id</title>
    <lemma id="l" status="review" by="ai"><title>L</title>x<comment by="ai">note</comment></lemma>
    <todo for="ai">do</todo>
  </section>
</document>`;

const MARKED = `<document>
  <team><member id="ai" name="Claude" kind="agent"/></team>
  <review/>
  <section id="s"><title>S</title>
    <lemma id="l" status="review" by="ai" verified-by="rb"><title>L</title>x</lemma>
    <theorem id="t">y<comment by="ai">quoted <equation id="q">z</equation></comment></theorem>
    <todo for="ai">do</todo>
    <draft by="ai" note="n">loose prose</draft>
    Sign: <change by="ai"><old>$x < 0$</old><new>$x > 0$</new></change>.
    <proof of="l" status="verified">done</proof>
  </section>
</document>`;

describe("the declared pipeline", () => {
  it("runs these steps in this order (read it top to bottom: that order is the architecture)", () => {
    const names = PIPELINE.flatMap((p) => p.steps.map((s) => `${p.name}/${s.name}`));
    expect(names).toEqual([
      "load/resolvePackages",
      "load/readSource",
      "load/parse",
      "load/resolveIncludes",
      "load/applyDocumentDefaults",
      "load/finalizeReview",
      "load/collectTeam",
      "load/expandAnimated",
      "load/expandCover",
      "collab/resolveCollab",
      "collab/summarizeFinal",
      "bibliography/loadBibliography",
      "bibliography/numberCitations",
      "bibliography/fillProjectBibliography",
      "numbering/numberDocument",
      "numbering/buildIdMaps",
      "render/renderMath",
      "render/highlightCode",
      "render/buildProjectToc",
      "render/buildProjectReview",
      "render/resolveReferences",
      "render/annotateCrossFileRefs",
      "render/annotateCrossFileCites",
      "render/inlineFigures",
      "render/resolveTheme",
      "render/resolveImports",
      "render/resolveLineBreaks",
      "emit/emit",
    ]);
  });

  it("bails exactly once, after `load`, and every step is either per-file or project-wide", () => {
    expect(PIPELINE.filter((p) => p.bail).map((p) => p.name)).toEqual(["load"]);
    for (const step of PIPELINE.flatMap((p) => p.steps)) {
      expect(Boolean(step.each) !== Boolean(step.all), step.name).toBe(true);
      expect(step.what.length, step.name).toBeGreaterThan(0);
    }
  });
});

describe("a single file is a project of one file", () => {
  const cases: [string, string, CompileOptions][] = [
    ["math, refs, cites and a bibliography", MATH_AND_REFS, {}],
    ["project-scoped toc and review with a team", PROJECT_SCOPED, {}],
    ["a marked-up paper built with --final", MARKED, { final: true }],
  ];
  for (const [label, src, options] of cases) {
    it(`compileFile and compileProject agree on ${label}`, () => {
      const { dir, paths } = scratch({ "doc.dlt": src });
      const single = compileFile(paths[0], options);
      const project = compileProject({ inputs: paths, outDir: dir }, options);
      expect(single.html).toBeDefined();
      expect(project.outputs).toHaveLength(1);
      expect(project.outputs[0].html).toBe(single.html);
      const messages = (ds: { message: string }[]) => ds.map((d) => d.message).sort();
      expect(messages(project.diagnostics)).toEqual(messages(single.diagnostics));
    });
  }
});

describe("the trace hook", () => {
  const A = `<document><section id="a"><title>A</title><theorem id="thm">x</theorem></section></document>`;
  const B = `<document><section id="b"><title>B</title>See <ref to="thm"/>.</section></document>`;

  it("fires after every file of a per-file step and after every step, in pipeline order", () => {
    const { dir, paths } = scratch({ "a.dlt": A, "b.dlt": B });
    const log: [string, string, string | undefined][] = [];
    // Events carry the LIVE files and shared state (no cloning), so anything a listener wants to
    // keep must be read inside the callback — as the docs' trace script does with structuredClone.
    const seen: Record<string, unknown> = {};
    const result = compileProject(
      { inputs: paths, outDir: dir },
      {
        trace: (e: TraceEvent) => {
          log.push([e.phase, e.step, e.file]);
          const bDoc = () => JSON.stringify(e.files[1].doc);
          if (e.step === "numberDocument" && e.file === "a.html") seen.registryAfterA = [...e.shared.registry.keys()];
          if (e.step === "numberDocument" && e.file === undefined) {
            seen.registryAfterNumbering = [...e.shared.registry.keys()];
            seen.htmlAfterNumbering = e.files.map((f) => f.html);
          }
          if (e.step === "resolveReferences" && e.file === "b.html") seen.hrefBefore = bDoc().includes("data-target-href");
          if (e.step === "annotateCrossFileRefs" && e.file === "b.html") seen.hrefAfter = bDoc().includes('"data-target-href":"a.html#thm"');
        },
      },
    );
    expect(result.outputs).toHaveLength(2);

    expect(log.slice(0, 3)).toEqual([
      ["load", "resolvePackages", undefined],
      ["load", "readSource", "a.html"],
      ["load", "readSource", "b.html"],
    ]);
    const steps = PIPELINE.flatMap((p) => p.steps);
    const perFile = steps.filter((s) => s.each).length;
    expect(log).toHaveLength(perFile * 2 + steps.length);
    expect(log[log.length - 1]).toEqual(["emit", "emit", undefined]);

    // Numbering runs file by file into one shared registry; nothing is emitted until the last phase.
    expect(seen.registryAfterA).toEqual(["a", "thm"]);
    expect(seen.registryAfterNumbering).toEqual(["a", "thm", "b"]);
    expect(seen.htmlAfterNumbering).toEqual([undefined, undefined]);
    // The cross-file href appears exactly at the step that writes it.
    expect(seen.hrefBefore).toBe(false);
    expect(seen.hrefAfter).toBe(true);
  });

  it("stops after `load` when a file is missing, and emits no event past that phase", () => {
    const { dir, paths } = scratch({ "a.dlt": A });
    const phases = new Set<string>();
    const result = compileProject(
      { inputs: [...paths, join(dir, "missing.dlt")], outDir: dir },
      { trace: (e) => phases.add(e.phase) },
    );
    expect(result.outputs).toHaveLength(0);
    expect(result.diagnostics.some((d) => d.severity === "error")).toBe(true);
    expect([...phases]).toEqual(["load"]);
  });
});
