import { SaxesParser } from "saxes";
import type { ElementNode } from "./ast";
import { error, type CompileContext } from "./context";

/**
 * Parses the source string into an AST. It relies on the saxes parser to handle the low-level parsing, and builds a tree of ElementNode and TextNode objects. It runs the document depth-first, so that in the stack, the last element is always the current parent element. It also merges adjacent text nodes into a single node.
 * @param source the source string to parse
 * @param ctx the compilation context
 * @returns the root element of the parsed document, or null if parsing failed
 */
export function parse(source: string, ctx: CompileContext): ElementNode | null {
  const parser = new SaxesParser();
  const root: ElementNode = { type: "element", tag: "#root", attrs: {}, children: [] };
  const stack: ElementNode[] = [root];
  let failed = false;

  parser.on("error", (err) => {
    failed = true;
    // saxes prefixes messages with "file:line:column:"; the diagnostic carries those.
    const message = err.message.replace(/^.*?:\d+:\d+:\s*/, "");
    error(ctx, message, { line: parser.line, column: parser.column });
  });

  parser.on("opentag", (tag) => {
    const el: ElementNode = {
      type: "element",
      tag: tag.name,
      attrs: { ...(tag.attributes as Record<string, string>) },
      children: [],
      pos: { line: parser.line, column: parser.column },
    };
    stack[stack.length - 1].children.push(el);
    stack.push(el);
  });

  parser.on("closetag", () => {
    // no need to check for mismatched tags; saxes already emits an error in that case
    // so it is safe to just pop the stack here.
    stack.pop(); 
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
