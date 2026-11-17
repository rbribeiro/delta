import {
  createContext,
  hasErrors,
  type CompileContext,
  type Diagnostic,
  type ReviewData,
  type ReviewItem,
} from "./context.ts";
import type { ProofGraph } from "./graph.ts";
import {
  createShared,
  outNameFor,
  runPipeline,
  type CompileOptions,
  type FileUnit,
} from "./pipeline.ts";

export type { CompileOptions, TraceEvent } from "./pipeline.ts";

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
  /** The proof graph (absent when the file failed to load), for the CLI's graph commands. */
  graph?: ProofGraph;
}

/**
 * Compiles a source string in the Delta XML dialect to HTML, using (and filling) the given
 * context. Returns the HTML, or undefined when compilation failed (`hasErrors(ctx)` is then true).
 * `--final` comes from `options.final`, as for `compileFile` and `compileProject`.
 */
export function compileSource(
  source: string,
  ctx: CompileContext,
  options: CompileOptions = {},
): string | undefined {
  return runOne({ ctx, outName: outNameFor(ctx.file), source, doc: null }, options).html;
}

/** Reads a `.dlt` file, compiles it, and returns the HTML along with diagnostics, deps and the review state. */
export function compileFile(path: string, options: CompileOptions = {}): CompileResult {
  const ctx = createContext(path);
  const { html, graph, reviewItems } = runOne(
    { ctx, outName: outNameFor(path), doc: null },
    options,
  );
  return {
    html,
    graph,
    diagnostics: ctx.diagnostics,
    deps: [...ctx.deps],
    // The project's list, so an item carries its home output (`file`) here as in a project.
    review: { team: [...ctx.team.values()], items: reviewItems },
  };
}

/** Runs the pipeline for one file whose context lends its own maps as the shared state. */
function runOne(
  unit: FileUnit,
  options: CompileOptions,
): { html?: string; graph?: ProofGraph; reviewItems: ReviewItem[] } {
  const { ctx } = unit;
  const shared = createShared({
    registry: ctx.registry,
    papers: ctx.papers,
    citedPapers: ctx.citedPapers,
    team: ctx.team,
    // From the options, as in a project; the pipeline then sets every file's ctx.final.
    final: options.final ?? false,
    project: createContext(ctx.file),
  });
  const ok = runPipeline([unit], shared, options);
  ctx.diagnostics.push(...shared.project.diagnostics); // the --final summary lands on the caller's ctx
  // The rule shared with a project: an error anywhere, in any phase, means no output.
  const failed = !ok || hasErrors(ctx);
  return {
    html: failed ? undefined : unit.html,
    graph: shared.graph,
    reviewItems: shared.reviewItems,
  };
}
