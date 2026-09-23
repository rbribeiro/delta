import { readFileSync } from "node:fs";
import { addDep, type CompileContext } from "./context";

/**
 * Helpers for the passes that read the author's *other* files: includes, the `.ref`
 * bibliography, themes, packs, figures. They share three rules. A `scheme://` source is
 * never fetched (the output must work offline). Every file read is recorded for `--watch`.
 * And a diagnostic raised while inside another file points at that file.
 */

/** True for `scheme://…`: a URL, which the compiler never fetches. */
export function isRemote(src: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(src);
}

/** Reads a user file as UTF-8 and records it as a dependency of this compile. Throws like `readFileSync`. */
export function readUserFile(ctx: CompileContext, abs: string): string {
  const text = readFileSync(abs, "utf8");
  addDep(ctx, abs);
  return text;
}

/**
 * Runs `fn` with `ctx.file` pointed at `abs`, so any diagnostic raised inside is attributed
 * to that file (and relative paths resolve against it). The previous file is restored
 * afterwards, even if `fn` throws.
 */
export function withFile<T>(ctx: CompileContext, abs: string, fn: () => T): T {
  const prev = ctx.file;
  ctx.file = abs;
  try {
    return fn();
  } finally {
    ctx.file = prev;
  }
}
