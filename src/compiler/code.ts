import { textContent, type ElementNode, type Node, type Position } from "./ast";
import { warn, type CompileContext } from "./context";
import { RAW_TAGS } from "../language/tags";
import { highlight } from "./highlight";
import { escapeHtml } from "./preprocess";

/** The highlighted display block. Inline `<c>` stays literal (styled by CSS only). */
const CODE_TAG = "code";

/**
 * Strips leading and trailing empty lines and dedents the code block by the minimum indentation of all non-empty lines.
 * Tabs are replaced with two spaces.
 *
 * @param source - the code source to be dedented
 * @returns string - the dedented code
 */
function dedent(source: string): string {
  let lines = source.replace(/\t/g, "  ").split("\n");
  while (lines.length > 0 && lines[0].trim() === "") lines = lines.slice(1);
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines = lines.slice(0, -1);
  const indents = lines.filter((l) => l.trim() !== "").map((l) => l.match(/^ */)?.[0].length ?? 0);
  const indent = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(indent)).join("\n");
}

/**
 * Highlights every `<code>` block in the document (highlight.ts). A block with no `lang`, or
 * an unknown one (a warning), is escaped and shown as plain text.
 *
 * @param doc - the root ElementNode to start highlighting from
 * @param ctx - the compilation context for warnings
 */
export function highlightCode(doc: ElementNode, ctx: CompileContext): void {
  walk(doc);

  // Recursively walks through the element tree, highlighting `<code>` blocks and skipping raw tags.
  function walk(el: ElementNode): void {
    if (el.tag === CODE_TAG) {
      const source = dedent(textContent(el));
      // Replace the children of the `<code>` element with a single highlighted node.
      el.children = [highlighted(source, el.attrs.lang, el.pos)];
      return;
    }
    if (RAW_TAGS.has(el.tag)) return;
    // Tag is not `<code>` or a raw tag, so we continue walking through its children.
    for (const child of el.children) if (child.type === "element") walk(child);
  }

  function highlighted(source: string, lang: string | undefined, pos?: Position): Node {
    const html = lang ? highlight(source, lang) : undefined;
    if (lang && html === undefined) warn(ctx, `code: unknown language "${lang}"`, pos);
    return { type: "raw", html: html ?? escapeHtml(source) };
  }
}
