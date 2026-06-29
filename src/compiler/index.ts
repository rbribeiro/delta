import { readFileSync } from "node:fs";
import { addDep, createContext, error, hasErrors, type CompileContext, type Diagnostic } from "./context";
import { emit } from "./emit";
import { inlineFigures } from "./figures";
import { resolveIncludes } from "./include";
import { expandAnimated } from "./animated";
import { renderMath } from "./math";
import { highlightCode } from "./code";
import { numberDocument } from "./numbering";
import { parse } from "./parse";
import { preprocess } from "./preprocess";
import { resolveReferences } from "./references";
import { resolveTheme } from "./theme";
import { buildToc } from "./toc";
import { resolveImports } from "./imports";
import { resolveLineBreaks } from "./linebreaks";
import { loadBibliography, resolveCitations } from "./bibliography";

export interface CompileResult {
  html?: string; // Only present if compilation succeeded.
  diagnostics: Diagnostic[];
  /** Absolute paths of every user file read while compiling (for `--watch`). */
  deps: string[];
}

/**
 * Compile a source string in the Delta XML dialect to HTML. 
 * It follows the pipeline: preprocess → parse → includes → bibliography → citations → number → math →
 * references → toc → inline figures → resolve theme → imports → emit. Pass order is load-bearing —
 * includes merge first so everything downstream sees one tree, the bibliography splices cited papers
 * 
 * @param source - the source string in the Delta XML dialect to compile
 * @param ctx - the compile context
 * @returns - the compiled HTML string, or undefined if compilation failed (hasErrors(ctx) is true)
 */
export function compileSource(source: string, ctx: CompileContext): string | undefined {
  const doc = parse(preprocess(source), ctx);
  if (!doc || hasErrors(ctx)) return undefined;
  resolveIncludes(doc, ctx); // splice <include> files into one tree (before numbering)
  if (hasErrors(ctx)) return undefined; // a missing/cyclic include fails the build
  // Parse and processes successfully, but may have non-fatal diagnostics. Continue to emit, but report
  ctx.lang = doc.attrs.lang ?? "en"; // drives i18n + <html lang>; read by emit and later passes
  expandAnimated(doc); // presentation only: animated="true" → reveal="true" on children
  // Bibliography runs before numbering so the cited papers it splices flow through the
  // normal passes (numbering skips them; math then renders any math in their fields).
  loadBibliography(doc, ctx); // build the paper registry; empty the <bibliography>
  resolveCitations(doc, ctx); // number <cite>; fill <bibliography> with cited papers
  // Numbering must run before math, since math needs the registry to resolve labels.
  numberDocument(doc, ctx);
  renderMath(doc, ctx);
  highlightCode(doc, ctx); // highlight <code> blocks (after math; math skips the code raw-tag)
  resolveReferences(doc, ctx); // resolve <ref to>; mark targets for snapshotting
  buildToc(doc, ctx); // collect the heading tree (+ auto-slug ids) if a <toc> is present
  inlineFigures(doc, ctx); // read figure images and embed them as data: URIs
  resolveTheme(doc, ctx); // read <document theme> CSS; emit inlines it last
  resolveImports(doc,ctx); // inline <import> packs (themes are inlined before the author theme, JS after the runtime)
  resolveLineBreaks(doc); // blank lines in prose become a single <br> (after every other pass)
  return emit(doc, ctx);
}

/**
 * Reads a source file in the Delta XML dialect, compiles it to HTML, and returns the result along with any diagnostics.
 * 
 * @param path - the path to the source file to compile
 * @returns - CompileResult with the compiled HTML string (if successful) and any diagnostics (errors/warnings)
 */
export function compileFile(path: string): CompileResult {
  const ctx = createContext(path);
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch (e) {
    error(ctx, e instanceof Error ? e.message : String(e));
    return { diagnostics: ctx.diagnostics, deps: [...ctx.deps] };
  }
  addDep(ctx, path);
  const html = compileSource(source, ctx);
  return { html, diagnostics: ctx.diagnostics, deps: [...ctx.deps] };
}
