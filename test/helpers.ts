import { type ElementNode } from "../src/compiler/ast";
import { createContext, type CompileContext } from "../src/compiler/context";
import { compileSource, type CompileOptions } from "../src/compiler/index";
import { numberDocument } from "../src/compiler/numbering";
import { parse } from "../src/compiler/parse";
import { preprocess } from "../src/compiler/preprocess";

/**
 * The three ways a test drives the compiler. Every pass test starts from one of these instead
 * of rebuilding a context and re-parsing by hand.
 */

/** Runs the whole pipeline on a source string; throws (with the diagnostics) if it fails. */
export function compile(src: string, options: CompileOptions = {}): { html: string; ctx: CompileContext } {
  const ctx = createContext("test.dlt");
  ctx.final = options.final ?? false;
  const html = compileSource(src, ctx, options);
  if (html === undefined) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return { html, ctx };
}

/** Just the front end: preprocess + parse into a fresh context, so a pass can be run by hand. */
export function parsed(src: string): { doc: ElementNode; ctx: CompileContext } {
  const ctx = createContext("test.dlt");
  const doc = parse(preprocess(src), ctx);
  if (!doc) throw new Error("parse failed: " + JSON.stringify(ctx.diagnostics));
  return { doc, ctx };
}

/** Parsed and numbered, for the passes that read the registry (references, toc, math). */
export function numbered(src: string): { doc: ElementNode; ctx: CompileContext } {
  const out = parsed(src);
  numberDocument(out.doc, out.ctx);
  return out;
}
