import { createContext, type CompileContext, type Diagnostic, type ReviewData } from "./context";
import { createShared, outNameFor, runPipeline, type CompileOptions, type FileUnit } from "./pipeline";

export type { CompileOptions, TraceEvent } from "./pipeline";

/**
 * The single-file entry points. Both are thin: a single file is a project of one file, and the
 * whole order of operations lives in `pipeline.ts` — read that next.
 */

export interface CompileResult {
  html?: string; // Only present if compilation succeeded.
  diagnostics: Diagnostic[];
  /** Absolute paths of every user file read while compiling (for `--watch`). */
  deps: string[];
  /** The collaboration state (`<team>` + comments/tasks/changes/status blocks), for `delta review`. */
  review?: ReviewData;
}

/**
 * Compiles a source string in the Delta XML dialect to HTML, using (and filling) the given
 * context. Returns the HTML, or undefined when compilation failed (`hasErrors(ctx)` is then true).
 */
export function compileSource(source: string, ctx: CompileContext, options: CompileOptions = {}): string | undefined {
  return runOne({ ctx, outName: outNameFor(ctx.file), source, doc: null }, options);
}

/** Reads a `.dlt` file, compiles it, and returns the HTML along with diagnostics, deps and the review state. */
export function compileFile(path: string, options: CompileOptions = {}): CompileResult {
  const ctx = createContext(path);
  ctx.final = options.final ?? false;
  const html = runOne({ ctx, outName: outNameFor(path), doc: null }, options);
  return {
    html,
    diagnostics: ctx.diagnostics,
    deps: [...ctx.deps],
    review: { team: [...ctx.team.values()], items: ctx.review },
  };
}

/** Runs the pipeline for one file whose context lends its own maps as the shared state. */
function runOne(unit: FileUnit, options: CompileOptions): string | undefined {
  const { ctx } = unit;
  const shared = createShared({
    registry: ctx.registry,
    papers: ctx.papers,
    citedPapers: ctx.citedPapers,
    team: ctx.team,
    final: ctx.final,
    project: createContext(ctx.file),
  });
  const ok = runPipeline([unit], shared, options);
  ctx.diagnostics.push(...shared.project.diagnostics); // the --final summary lands on the caller's ctx
  return ok ? unit.html : undefined;
}
