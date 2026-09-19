import { dirname, relative, resolve, sep } from "node:path";
import { type ElementNode, type Node, findElementById } from "./ast";
import { error, type CompileContext } from "./context";
import { isRemote, readUserFile, withFile } from "./files";
import { parse } from "./parse";
import { preprocess } from "./preprocess";

// figure, video and audio are the only tags that can have a relative src that needs to be rewritten to be relative to the master document.
const ASSET_TAGS = new Set(["figure", "video", "audio"]);

/**
 * Resolves `<include>` nodes in `doc` by reading the referenced files, parsing them, and splicing their children in place of the `<include>`. Relative asset paths are rewritten relative to the master document. Cycles are detected and reported as errors.
 * 
 * @param doc - the document node to scan for `<include>` children
 * @param ctx - the compiler context, used for errors and for the current file path (used to resolve relative includes)
 */
export function resolveIncludes(doc: ElementNode, ctx: CompileContext): void {
  const masterDir = resolve(dirname(ctx.file));
  walk(doc, masterDir, [resolve(ctx.file)], masterDir, ctx);
}

/** Resolve includes within `node`, with `dir` = the directory of `node`'s file. */
function walk(
  node: ElementNode,
  dir: string,
  stack: string[],
  masterDir: string,
  ctx: CompileContext,
): void {
  node.children = node.children.flatMap((child): Node[] => {
    if (child.type !== "element") return [child];
    if (child.tag === "include") return expand(child, dir, stack, masterDir, ctx);
    rewriteAsset(child, dir, masterDir);
    walk(child, dir, stack, masterDir, ctx);
    return [child];
  });
}

/** Read + parse one `<include>` and return its (fully resolved) children. */
function expand(
  inc: ElementNode,
  dir: string,
  stack: string[],
  masterDir: string,
  ctx: CompileContext,
): Node[] {
  const src = inc.attrs.src;
  const targetId = inc.attrs["target-id"];
  
  if (!src) {
    error(ctx, "<include> without a 'src' attribute", inc.pos);
    return [];
  }
  if (isRemote(src)) {
    error(ctx, `include src must be a local path, not a URL: ${src}`, inc.pos);
    return [];
  }

  const abs = resolve(dir, src);
  if (stack.includes(abs)) {
    const chain = [...stack, abs].map((p) => relative(masterDir, p) || p).join(" → ");
    error(ctx, `include cycle: ${chain}`, inc.pos);
    return [];
  }

  let text: string;
  try {
    text = readUserFile(ctx, abs);
  } catch {
    error(ctx, `include file not found: ${src}`, inc.pos);
    return [];
  }

  // Diagnostics raised while parsing and walking the included file point at that file.
  return withFile(ctx, abs, (): Node[] => {
    const root = parse(preprocess(text), ctx);
    if (!root) return [];
    // `target-id` includes only the element with that id, not the whole file.
    if (targetId) {
      const target = findElementById(root, targetId);
      if (target === null) {
        error(ctx, `include target-id not found: ${targetId}`, inc.pos);
      } else if (target === undefined) {
        error(ctx, `Can't resolve include target-id: ${targetId} (multiple elements with the same id found)`, inc.pos);
      } else {
        root.children = [target];
      }
    }
    // Splice the included document's children (a non-document root is spliced as-is), wrapped in a
    // throwaway container so nested includes and asset paths resolve relative to the included file.
    const kids = root.tag === "document" ? root.children : [root];
    const container: ElementNode = { type: "element", tag: "#include", attrs: {}, children: kids };
    walk(container, dirname(abs), [...stack, abs], masterDir, ctx);
    return container.children;
  });
}

/** Rewrite a relative asset `src` so it resolves relative to the master document. */
function rewriteAsset(el: ElementNode, dir: string, masterDir: string): void {
  if (dir === masterDir || !ASSET_TAGS.has(el.tag)) return;
  const src = el.attrs.src;
  if (!src || src.startsWith("data:") || src.startsWith("/") || isRemote(src)) return;
  el.attrs.src = relative(masterDir, resolve(dir, src)).split(sep).join("/");
}
