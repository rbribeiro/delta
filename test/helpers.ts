import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ElementNode } from "../src/compiler/ast";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource, type CompileOptions } from "../src/compiler/index";
import { numberDocument } from "../src/compiler/numbering";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";
import { compileProject, type ProjectResult } from "../src/compiler/project";

/**
 * The ways a test drives the compiler. Every pass test starts from one of these instead of
 * rebuilding a context and re-parsing by hand. `file` is the path the source pretends to
 * live at: relative assets (a theme, a `.ref` bibliography, a pack) resolve from its folder,
 * so a test that uses the fixtures passes `"test/doc.dlt"`. Runtime (browser) tests have
 * their own helper, test/runtime/helpers.ts.
 */

/** Runs the whole pipeline on a source string; throws (with the diagnostics) if it fails. */
export function compile(
  src: string,
  options: CompileOptions & { file?: string } = {},
): { html: string; ctx: CompileContext } {
  const ctx = createContext(options.file ?? "test.dlt");
  ctx.final = options.final ?? false;
  const html = compileSource(src, ctx, options);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

/** `compile(src).html`, for the tests that only look at the output. */
export function compileHtml(src: string, options: CompileOptions & { file?: string } = {}): string {
  return compile(src, options).html;
}

/** Just the front end: preprocess + parse into a fresh context, so a pass can be run by hand. */
export function parsed(src: string, file = "test.dlt"): { doc: ElementNode; ctx: CompileContext } {
  const ctx = createContext(file);
  const doc = parse(preprocess(src), ctx);
  if (!doc) throw new Error("parse failed: " + JSON.stringify(ctx.diagnostics));
  return { doc, ctx };
}

/** Parsed and numbered, for the passes that read the registry (references, toc, math). */
export function numbered(src: string, file = "test.dlt"): { doc: ElementNode; ctx: CompileContext } {
  const out = parsed(src, file);
  numberDocument(out.doc, out.ctx);
  return out;
}

/** The messages of every warning in `ctx`. */
export function warnings(ctx: CompileContext): string[] {
  return ctx.diagnostics.filter((d) => d.severity === "warning").map((d) => d.message);
}

/**
 * Writes `files` (name → source) into a fresh temp folder and compiles them as one project,
 * for the tests that need real files (source spans, includes, several outputs). `html(name)`
 * is the output for one file ("p.html"), or "" when there is none.
 */
export function compileFiles(files: Record<string, string>): ProjectResult & { dir: string; html: (name: string) => string } {
  const dir = mkdtempSync(join(tmpdir(), "delta-test-"));
  for (const [name, src] of Object.entries(files)) writeFileSync(join(dir, name), src);
  const result = compileProject({ inputs: Object.keys(files).map((n) => join(dir, n)), outDir: dir });
  return { ...result, dir, html: (name) => result.outputs.find((o) => o.path.endsWith(name))?.html ?? "" };
}
