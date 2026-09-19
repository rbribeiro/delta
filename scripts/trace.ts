import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { Node } from "../src/compiler/ast";
import { loadProjectConfig } from "../src/compiler/config";
import type { CompileContext } from "../src/compiler/context";
import { PIPELINE, type Shared } from "../src/compiler/pipeline";
import { compileProject } from "../src/compiler/project";

/**
 * Generates the data behind the docs' pipeline explorer (`site/compilador.dlt`).
 *
 * It compiles the tiny two-file project in `site/packs/pipeline/sample/` with the pipeline's
 * `trace` hook, snapshots the tree, the per-file context and the shared state after every
 * step, and writes `site/packs/pipeline/dist/index.js` = the data + the custom element. The
 * pack is inlined into the page like any other, so the explorer never drifts from the
 * compiler: whatever the pipeline does is what the page shows.
 *
 *   npm run trace        (also run by `predocs`, so `npm run docs` is enough)
 */

const PACK = resolve("site/packs/pipeline");
const SAMPLE = resolve(PACK, "sample/project.toml");

/** Text nodes are shortened and whitespace-only ones dropped: the tree must fit on screen. */
const TEXT_MAX = 40;

type AstSnapshot =
  | { tag: string; attrs: Record<string, string>; children: AstSnapshot[] }
  | { text: string }
  | { raw: string };

function projectAst(node: Node): AstSnapshot | null {
  switch (node.type) {
    case "text": {
      const text = node.text.replace(/\s+/g, " ").trim();
      if (!text) return null;
      return { text: text.length > TEXT_MAX ? text.slice(0, TEXT_MAX - 1) + "…" : text };
    }
    case "raw":
      return { raw: node.kind === "math" ? "KaTeX" : node.html === "<br><br>" ? "<br>" : "código" };
    case "element":
      return {
        tag: node.tag,
        attrs: { ...node.attrs },
        children: node.children.map(projectAst).filter((c): c is AstSnapshot => c !== null),
      };
  }
}

/** The per-file context, reduced to what a student should watch (the shared maps live in `shared`). */
function projectCtx(ctx: CompileContext): Record<string, unknown> {
  return {
    file: basename(ctx.file),
    outName: ctx.outName,
    lang: ctx.lang,
    mathUsed: ctx.mathUsed,
    referencedIds: [...ctx.referencedIds],
    toc: ctx.toc.map((e) => ({ level: e.level, id: e.id, num: e.num, ...(e.file ? { file: e.file } : {}) })),
    review: ctx.review.map((i) => `${i.kind} ${i.id}`),
    imports: ctx.imports.map((i) => i.name ?? basename(i.source)),
    userCss: ctx.userCss !== undefined,
    builtinCss: ctx.builtinCss !== undefined,
    themeAccent: ctx.themeAccent ?? null,
    themeMode: ctx.themeMode ?? null,
    deps: [...ctx.deps].map((d) => basename(d)),
    diagnostics: ctx.diagnostics.map((d) => `${d.severity}: ${d.message}`),
  };
}

/** What `emit` produced for one file: the pieces a reader cannot see in the tree. */
function summarizeHtml(html: string, idToFile: Map<string, string>, outName: string, mathUsed: boolean): Record<string, unknown> {
  const templates: { id: string; from: string; html: string }[] = [];
  const re = /<template data-delta-pop="([^"]+)">([\s\S]*?)<\/template>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const body = m[2].replace(/\s+/g, " ");
    const from = idToFile.get(m[1]);
    templates.push({
      id: m[1],
      from: from === undefined ? "?" : from === outName ? "este arquivo" : from,
      html: body.length > 160 ? body.slice(0, 159) + "…" : body,
    });
  }
  const islands = ["delta-toc", "delta-review", "delta-i18n"].filter((id) => html.includes(`id="${id}"`));
  const packs = [...html.matchAll(/\/\* pack: ([^*]+?) \*\//g)].map((p) => p[1]);
  return {
    bytes: html.length,
    katexCss: mathUsed, // emit inlines the KaTeX stylesheet exactly when ctx.mathUsed is set
    templates,
    islands,
    packs,
  };
}

function projectShared(s: Shared): Record<string, unknown> {
  return {
    counters: { ...s.numbering.counters },
    display: { ...s.numbering.display },
    registry: Object.fromEntries([...s.registry].map(([id, e]) => [id, { tag: e.tag, num: e.num }])),
    // The node itself cannot be serialized (it is the live tree); its tag is what a reader needs to see.
    globalById: Object.fromEntries([...s.globalById].map(([id, el]) => [id, el.tag])),
    idToFile: Object.fromEntries(s.idToFile),
    papers: [...s.papers.keys()],
    citedPapers: [...s.citedPapers],
    team: [...s.team.keys()],
    bibOut: s.bibOut ?? null,
    projectImports: s.project.imports.map((i) => i.name ?? basename(i.source)),
    projectDiagnostics: s.project.diagnostics.map((d) => `${d.severity}: ${d.message}`),
  };
}

function main(): void {
  const { config, diagnostics } = loadProjectConfig(SAMPLE);
  for (const d of diagnostics) console.error(`${d.severity}: ${d.message}`);
  if (!config) throw new Error("could not load the sample project");

  const descriptions = JSON.parse(readFileSync(resolve(PACK, "descriptions.json"), "utf8")) as {
    phases: Record<string, string>;
    steps: Record<string, string>;
  };
  for (const phase of PIPELINE) {
    if (!descriptions.phases[phase.name]) console.warn(`descriptions.json: no description for phase "${phase.name}"`);
    for (const step of phase.steps) {
      if (!descriptions.steps[step.name]) console.warn(`descriptions.json: no description for step "${step.name}"`);
    }
  }

  const allSteps = new Set(PIPELINE.flatMap((p) => p.steps.filter((s) => s.all).map((s) => s.name)));
  const events: unknown[] = [];
  const prevAst: (string | undefined)[] = [];
  const result = compileProject(config, {
    trace: (e) => {
      // A per-file step fires once per file (keep those) plus a completion event (redundant);
      // a project-wide step fires only the completion event (keep it).
      const isAll = allSteps.has(e.step);
      if (isAll ? e.file !== undefined : e.file === undefined) return;
      const files = e.files.map((f, i) => {
        const json = JSON.stringify(f.doc ? projectAst(f.doc) : null);
        const ast = json === prevAst[i] ? "unchanged" : JSON.parse(json);
        prevAst[i] = json;
        const html = f.html === undefined ? null : summarizeHtml(f.html, e.shared.idToFile, f.outName, f.ctx.mathUsed);
        return { ast, ctx: projectCtx(f.ctx), html };
      });
      events.push({
        phase: e.phase,
        step: e.step,
        file: e.file === undefined ? null : e.files.findIndex((f) => f.outName === e.file),
        files,
        shared: projectShared(e.shared),
      });
    },
  });
  for (const d of result.diagnostics) console.error(`${d.severity}: ${d.message} (${d.file})`);
  if (result.outputs.length === 0) throw new Error("the sample project failed to compile");

  const data = {
    files: config.inputs.map((p) => basename(p)),
    sources: Object.fromEntries(config.inputs.map((p) => [basename(p), readFileSync(p, "utf8")])),
    phases: PIPELINE.map((p) => ({
      name: p.name,
      what: p.what,
      bail: Boolean(p.bail),
      steps: p.steps.map((s) => ({ name: s.name, what: s.what, kind: s.each ? "each" : "all" })),
    })),
    descriptions,
    events,
  };

  const element = readFileSync(resolve(PACK, "element.js"), "utf8");
  const js =
    "/* Generated by scripts/trace.ts from site/packs/pipeline/sample — do not edit, do not commit. */\n" +
    `window.DeltaPipelineTrace = ${JSON.stringify(data)};\n` +
    element;
  mkdirSync(resolve(PACK, "dist"), { recursive: true });
  writeFileSync(resolve(PACK, "dist/index.js"), js);
  console.error(`site/packs/pipeline/dist/index.js: ${events.length} events, ${(js.length / 1024).toFixed(0)} KB`);
}

main();
