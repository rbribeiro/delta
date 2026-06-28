import hljs from "highlight.js";
import { textContent, type ElementNode, type Node, type Position } from "./ast";
import { warn, type CompileContext } from "./context";
import { RAW_TAGS } from "./preprocess";

/** The highlighted display block. Inline `<c>` stays literal (styled by CSS only). */
const CODE_TAG = "code";

// Entities to be escaped in `<code>` blocks. We don't escape quotes because they are not allowed in `<code>` content.
const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };
function escapeHtml(s: string): string {
  return s.replace(/[&<>]/g, (c) => ENTITIES[c]);
}

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
  const indents = lines
    .filter((l) => l.trim() !== "")
    .map((l) => (l.match(/^ */)?.[0].length ?? 0));
  const indent = indents.length ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(indent)).join("\n");
}

/**
 * Highlights all `<code>` blocks in the given document using highlight.js. If the language is not specified or unknown, 
 * the code will be escaped and displayed as-is. Warnings are issued for unknown languages or errors during highlighting.
 * 
 * @param doc - the root ElementNode to start highlighting from
 * @param ctx - the compilation context for warnings and errors
 */
export function highlightCode(doc: ElementNode, ctx: CompileContext): void {
  walk(doc);

  // Recursively walks through the element tree, highlighting `<code>` blocks and skipping raw tags.
  function walk(el: ElementNode): void {
    if (el.tag === CODE_TAG) {
      const source = dedent(textContent(el));
      // Replace the children of the `<code>` element with a single highlighted node.
      el.children = [highlight(source, el.attrs.lang, el.pos)];
      return;
    }
    if (RAW_TAGS.has(el.tag)) return;
    // Tag is not `<code>` or a raw tag, so we continue walking through its children.
    for (const child of el.children) if (child.type === "element") walk(child);
  }

  function highlight(source: string, lang: string | undefined, pos?: Position): Node {
    if (!lang) return { type: "raw", html: escapeHtml(source) };
    if (!hljs.getLanguage(lang)) {
      warn(ctx, `code: unknown language "${lang}"`, pos);
      return { type: "raw", html: escapeHtml(source) };
    }
    try {
      // Highlight the code using highlight.js and return a raw node with the highlighted HTML.
      // This allows the highlighted code to be inserted directly into the output without further escaping.
      return { type: "raw", html: hljs.highlight(source, { language: lang }).value };
    } catch (e) {
      warn(ctx, `code: ${e instanceof Error ? e.message : String(e)}`, pos);
      return { type: "raw", html: escapeHtml(source) };
    }
  }
}
