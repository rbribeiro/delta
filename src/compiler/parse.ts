import { SaxesParser } from "saxes";
import type { ElementNode } from "./ast";
import { error, type CompileContext } from "./context";
import { preprocessMapped } from "./preprocess";

/**
 * Preprocesses and parses the author's text, recording it in `ctx.sources` under `ctx.file`
 * and giving every element its exact `src` span in that text (what `delta show` prints).
 */
export function parseSource(source: string, ctx: CompileContext): ElementNode | null {
  const { text, map, problems } = preprocessMapped(source);
  ctx.sources.set(ctx.file, source);
  // A forgotten `\$` is an error at the dollar itself, like a bare `<`.
  for (const p of problems) {
    const before = source.slice(0, p.at);
    const line = before.split("\n").length;
    const column = p.at - before.lastIndexOf("\n");
    error(ctx, p.message, { line, column, file: ctx.file });
  }
  return parse(text, ctx, map);
}

/**
 * Parses the source string into an AST. It relies on the saxes parser to handle the low-level parsing, and builds a tree of ElementNode and TextNode objects. It runs the document depth-first, so that in the stack, the last element is always the current parent element. It also merges adjacent text nodes into a single node.
 * @param source the source string to parse
 * @param ctx the compilation context
 * @param map offset map from `preprocessMapped`: turns positions in `source` into positions in
 * the author's text (without it, spans are offsets into `source` itself)
 * @returns the root element of the parsed document, or null if parsing failed
 */
export function parse(source: string, ctx: CompileContext, map?: number[]): ElementNode | null {
  const parser = new SaxesParser();
  const root: ElementNode = { type: "element", tag: "#root", attrs: {}, children: [] };
  const stack: ElementNode[] = [root];
  let failed = false;
  const file = ctx.file;
  const orig = (at: number): number => (map ? (map[at] ?? source.length) : at);
  let tagStart = 0;

  parser.on("error", (err) => {
    failed = true;
    // saxes prefixes messages with "file:line:column:"; the diagnostic carries those.
    const message = err.message.replace(/^.*?:\d+:\d+:\s*/, "");
    error(ctx, message, { line: parser.line, column: parser.column });
  });

  // saxes reports `position` just past the tag name (plus one character of lookahead), so
  // the opening `<` is the last `<name` at or before it.
  parser.on("opentagstart", (tag) => {
    tagStart = source.lastIndexOf(`<${tag.name}`, parser.position);
  });

  parser.on("opentag", (tag) => {
    const el: ElementNode = {
      type: "element",
      tag: tag.name,
      attrs: { ...(tag.attributes as Record<string, string>) },
      children: [],
      pos: { line: parser.line, column: parser.column, file },
      // `position` is just past the opening tag's `>`: the content starts there.
      src: { file, start: orig(tagStart), end: orig(tagStart), inner: orig(parser.position - 1) + 1, innerEnd: 0 },
    };
    stack[stack.length - 1].children.push(el);
    stack.push(el);
  });

  parser.on("closetag", (tag) => {
    // no need to check for mismatched tags; saxes already emits an error in that case
    // so it is safe to just pop the stack here. `position` is just past the closing `>`.
    const el = stack.pop();
    if (el?.src) {
      el.src.end = orig(parser.position - 1) + 1;
      const close = tag.isSelfClosing ? -1 : source.lastIndexOf(`</${tag.name}`, parser.position);
      el.src.innerEnd = close === -1 ? el.src.inner : orig(close);
    }
  });

  /**
   * SAX parses text nodes in chunks, so we need to merge adjacent text nodes into a single node. This function adds the given text to the last text node if it exists, or creates a new text node otherwise.
   * @param text the text content to add
   */
  const addText = (text: string): void => {
    const siblings = stack[stack.length - 1].children; // the last element in the stack is the current parent element
    const last = siblings[siblings.length - 1];
    if (last?.type === "text") last.text += text;
    else siblings.push({ type: "text", text });
  };
  parser.on("text", addText);
  parser.on("cdata", addText);

  parser.write(source).close();
  if (failed) return null;

  // We might want to change this in the future to allow multiple root elements, but for now we just take the first one and ignore the rest.
  const doc = root.children.find((c): c is ElementNode => c.type === "element");
  if (!doc) {
    error(ctx, "no root element found");
    return null;
  }
  
  return doc;
}
