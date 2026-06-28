import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { elements, type ElementNode } from "./ast";
import { loadBibliography, numberCitations, fillBibliography } from "./bibliography";
import type { ProjectConfig } from "./config";
import {
  createContext,
  error,
  hasErrors,
  warn,
  type CompileContext,
  type Diagnostic,
  type LabelEntry,
} from "./context";
import { emit } from "./emit";
import { inlineFigures } from "./figures";
import { resolveImports } from "./imports";
import { resolveIncludes } from "./include";
import { renderMath } from "./math";
import { freshNumbering, numberDocument } from "./numbering";
import { parse } from "./parse";
import { preprocess } from "./preprocess";
import { resolveReferences, REF_TAGS } from "./references";
import { resolveTheme } from "./theme";
import { buildProjectToc } from "./toc";

export interface ProjectResult {
  /** One per input, in declaration order; written verbatim by the CLI. */
  outputs: { path: string; html: string }[];
  diagnostics: Diagnostic[];
}

/** Flat output name for an input: `chapters/01.dlt` → `01.html`. */
export function outNameFor(input: string): string {
  return basename(input).replace(/\.dlt$/, "") + ".html";
}

/**
 * Compiles a set of `.dlt` files as one project: many inputs → many standalone
 * HTML outputs that share numbering and one registry, so a `<ref>`/`<cite>` in any
 * file resolves to a target in any other and ships a copy of it into that output
 * (no fetch). It runs the same passes as `compileSource`, but threaded across
 * files: numbering continues file-to-file, the registry/papers/cited list are
 * shared, and emit is deferred until every file is fully processed so cross-file
 * snapshots carry rendered math.
 */
export function compileProject(config: ProjectConfig): ProjectResult {
  // Shared across the project. `referencedIds` stays per file (each output only
  // snapshots what it itself references).
  const registry = new Map<string, LabelEntry>();
  const papers = new Map<string, ElementNode>();
  const citedPapers: string[] = [];

  const projectDiags: Diagnostic[] = [];
  const ctxs: CompileContext[] = [];
  const gather = (): Diagnostic[] => [...projectDiags, ...ctxs.flatMap((c) => c.diagnostics)];

  // Flat layout: outputs collide if two inputs share a basename.
  const seen = new Map<string, string>();
  for (const input of config.inputs) {
    const out = outNameFor(input);
    const prev = seen.get(out);
    if (prev) {
      projectDiags.push({
        severity: "error",
        message: `duplicate output "${out}" from ${input} and ${prev}`,
        file: input,
      });
    }
    seen.set(out, input);
  }
  if (projectDiags.some((d) => d.severity === "error")) return { outputs: [], diagnostics: gather() };

  // Phase 1 — read, parse, splice includes. Each file gets its own ctx (with the
  // shared registries swapped in) so diagnostics stay attributed to it.
  const files: { ctx: CompileContext; doc: ElementNode; outName: string }[] = [];
  for (const input of config.inputs) {
    const ctx = createContext(input);
    ctx.registry = registry;
    ctx.papers = papers;
    ctx.citedPapers = citedPapers;
    ctx.outName = outNameFor(input);
    ctxs.push(ctx);

    let source: string;
    try {
      source = readFileSync(input, "utf8");
    } catch (e) {
      error(ctx, e instanceof Error ? e.message : String(e));
      continue;
    }
    const doc = parse(preprocess(source), ctx);
    if (!doc) continue;
    resolveIncludes(doc, ctx);
    ctx.lang = doc.attrs.lang ?? "en";
    files.push({ ctx, doc, outName: ctx.outName });
  }
  // A missing file, parse error, or bad include fails the whole project.
  if (ctxs.some(hasErrors)) return { outputs: [], diagnostics: gather() };

  // Phase 2 — bibliography & citations, project-wide. Papers from every file load
  // into the shared registry; cites number across files in first-appearance order.
  for (const f of files) loadBibliography(f.doc, f.ctx);
  for (const f of files) numberCitations(f.doc, f.ctx);

  // The project has at most one rendered references list: the first file (in order)
  // that declares a <bibliography>. Extras stay empty and warn.
  const bibFiles = files.filter((f) => hasBibliography(f.doc));
  const bibFile = bibFiles[0];
  if (bibFile) {
    fillBibliography(bibFile.doc, bibFile.ctx);
    for (const extra of bibFiles.slice(1)) {
      warn(
        extra.ctx,
        "multiple <bibliography> elements in the project; only the first renders the references list",
      );
    }
  } else if (citedPapers.length > 0) {
    warn(files[0].ctx, "citations present but no <bibliography> element in the project to render them");
  }

  // Phase 3 — shared numbering: one counter state threaded through the files in
  // order, into the one shared registry.
  const numState = freshNumbering();
  for (const f of files) numberDocument(f.doc, f.ctx, numState);

  // After numbering + bib fill, node identities are stable (later passes only
  // mutate in place), so build the project-wide id maps once.
  // TODO: check if it is better to add an outputFile to the interfaces
  // together with getElementById method so we have only one compilation method.
  const globalById = new Map<string, ElementNode>();
  const idToFile = new Map<string, string>(); // id → home output name
  for (const f of files) {
    for (const el of elements(f.doc)) {
      const id = el.attrs.id;
      if (id && !globalById.has(id)) {
        globalById.set(id, el);
        idToFile.set(id, f.outName);
      }
    }
  }
  const bibOut = bibFile?.outName;

  // Phase 4 — the rest of the per-file pipeline. Math runs for *every* file first,
  // before the ToC (which captures rendered heading titles) and before any emit below
  // (so a cross-file snapshot carries rendered math).
  for (const f of files) renderMath(f.doc, f.ctx);

  // One book-wide ToC across the files (when a <toc scope="project"> asks for it),
  // else per-file tocs — replaces the single-file buildToc call.
  buildProjectToc(files);

  for (const f of files) {
    resolveReferences(f.doc, f.ctx);
    annotateCrossFileRefs(f.doc, f.outName, idToFile);
    if (bibOut && bibOut !== f.outName) annotateCrossFileCites(f.doc, bibOut);
    inlineFigures(f.doc, f.ctx);
    resolveTheme(f.doc, f.ctx);
    resolveImports(f.doc, f.ctx);
  }

  // Phase 5 — emit. `globalById` spans every file, so cross-file targets snapshot in.
  const outputs = files.map((f) => ({
    path: join(config.outDir, f.outName),
    html: emit(f.doc, f.ctx, globalById),
  }));
  return { outputs, diagnostics: gather() };
}

function hasBibliography(doc: ElementNode): boolean {
  for (const el of elements(doc)) if (el.tag === "bibliography") return true;
  return false;
}

/**
 * For a resolved `<ref>`/`<solution>`/`<proof>` whose target lives in another
 * output, records `data-target-href="<file>#<id>"` so the runtime navigates there
 * instead of doing an in-page scroll. Same-file refs are left alone.
 */
function annotateCrossFileRefs(
  doc: ElementNode,
  outName: string,
  idToFile: Map<string, string>,
): void {
  for (const el of elements(doc)) {
    if (!REF_TAGS.has(el.tag)) continue;
    if (el.attrs["data-target-num"] === undefined) continue; // unresolved: leave bare
    const to = el.tag === "ref" ? el.attrs.to : el.attrs.of;
    const home = to ? idToFile.get(to) : undefined;
    if (home && home !== outName) el.attrs["data-target-href"] = `${home}#${to}`;
  }
}

/** Records the references list's output on each resolved `<cite>` in another file. */
function annotateCrossFileCites(doc: ElementNode, bibOut: string): void {
  for (const el of elements(doc)) {
    if (el.tag !== "cite") continue;
    if (el.attrs["data-cite-nums"] === undefined) continue; // unresolved: leave inert
    el.attrs["data-cite-file"] = bibOut;
  }
}
