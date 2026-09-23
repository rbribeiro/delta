import { join } from "node:path";
import type { ProjectConfig } from "./config";
import { createContext, hasErrors, type Diagnostic, type ReviewData } from "./context";
import { createShared, outNameFor, runPipeline, type CompileOptions, type FileUnit } from "./pipeline";

export { outNameFor } from "./pipeline";

export interface ProjectResult {
  /** One per input, in declaration order; written verbatim by the CLI. */
  outputs: { path: string; html: string }[];
  diagnostics: Diagnostic[];
  /** Absolute paths of every user file read across all inputs (for `--watch`). */
  deps: string[];
  /** The project's collaboration state, every item tagged with its home output (for `delta review`). */
  review?: ReviewData;
}

/**
 * Compiles a set of `.dlt` files as one project: many inputs → many standalone HTML outputs
 * that share numbering and one registry, so a `<ref>`/`<cite>` in any file resolves to a
 * target in any other and ships a copy of it into that output (no fetch). The order of
 * operations is the `PIPELINE` table in `pipeline.ts`; this function only sets up the shared
 * state, one context per file (so diagnostics stay attributed), and collects the results.
 */
export function compileProject(config: ProjectConfig, options: CompileOptions = {}): ProjectResult {
  const project = createContext(config.root ?? config.inputs[0] ?? config.outDir);
  const shared = createShared({ final: options.final ?? false, config, project });

  // Flat layout: outputs collide if two inputs share a basename.
  const seen = new Map<string, string>();
  for (const input of config.inputs) {
    const out = outNameFor(input);
    const prev = seen.get(out);
    if (prev) {
      project.diagnostics.push({
        severity: "error",
        message: `duplicate output "${out}" from ${input} and ${prev}`,
        file: input,
      });
    }
    seen.set(out, input);
  }
  if (hasErrors(project)) return { outputs: [], diagnostics: project.diagnostics, deps: [] };

  const files: FileUnit[] = config.inputs.map((input) => ({
    ctx: createContext(input),
    outName: outNameFor(input),
    doc: null,
  }));
  const ok = runPipeline(files, shared, options);

  const ctxs = [project, ...files.map((f) => f.ctx)];
  const diagnostics = ctxs.flatMap((c) => c.diagnostics);
  const deps = [...new Set(ctxs.flatMap((c) => [...c.deps]))];
  if (!ok) return { outputs: [], diagnostics, deps };
  return {
    outputs: files.map((f) => ({ path: join(config.outDir, f.outName), html: f.html! })),
    diagnostics,
    deps,
    review: { team: [...shared.team.values()], items: shared.reviewItems },
  };
}
