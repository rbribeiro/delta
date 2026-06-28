import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { elements, type ElementNode } from "./ast";
import { addDep, warn, type CompileContext } from "./context";


const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/**
 * Inlines all `<figure src="…">` images as `data:` URIs so the output stays
 * self-contained (the browser runs offline; only the compiler can read files).
 * The image is resolved relative to the document, base64-encoded, and written
 * back to `src`, the runtime then builds the `<img>` from it. A missing,
 * unsupported, or remote source is a *warning* (the src is dropped, the runtime
 * shows a "missing" note), never a build failure.
 *
 * @param doc - the AST node representing the document
 * @param ctx - the compiler context
 */

export function inlineFigures(doc: ElementNode, ctx: CompileContext): void {
  const base = dirname(ctx.file);
  for (const el of elements(doc)) {
    if (el.tag !== "figure") continue;
    const src = el.attrs.src;
    if (!src || src.startsWith("data:")) continue;

    if (/^[a-z]+:\/\//i.test(src)) {
      warn(ctx, `figure src must be a local path, not a URL: ${src}`, el.pos);
      delete el.attrs.src;
      continue;
    }
    const mime = MIME[extname(src).toLowerCase()];
    if (!mime) {
      warn(ctx, `unsupported image type for figure: ${src}`, el.pos);
      delete el.attrs.src;
      continue;
    }
    try {
      const imgPath = resolve(base, src);
      const data = readFileSync(imgPath);
      addDep(ctx, imgPath);
      el.attrs.src = `data:${mime};base64,${data.toString("base64")}`;
    } catch {
      warn(ctx, `figure image not found: ${src}`, el.pos);
      delete el.attrs.src;
    }
  }
}
