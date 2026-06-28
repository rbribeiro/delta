import katex from "katex";
import { textContent, type ElementNode, type Node, type Position } from "./ast";
import { error, warn, type CompileContext } from "./context";
import { RAW_TAGS } from "./preprocess";

/** Tags whose content is LaTeX, rendered at compile time. */
const MATH_TAGS = new Set(["m", "math", "equation", "equations"]);

/**
 * Renders all math to HTML at compile time — KaTeX itself never ships to the
 * browser, only its CSS does. Covers MATH_TAGS plus `$…$` / `$$…$$` in prose,
 * and unescapes `\$`. Non-math RAW_TAGS (code) are left untouched. A LaTeX error
 * is an error: the source text is emitted as fallback. (see `render()` below)
 */

/**
 * Renders all math elements in the document to HTML using KaTeX.
 * @param doc - the root element of the document
 * @param ctx - the compilation context
 */
export function renderMath(doc: ElementNode, ctx: CompileContext): void {
  visit(doc);

  function visit(el: ElementNode): void {
    if (MATH_TAGS.has(el.tag)) {
      const source = textContent(el);
      const latex =
        el.tag === "equations" ? `\\begin{aligned}${source}\\end{aligned}` : source;
      el.children = [render(latex, el.tag !== "m", el.pos)];
      return;
    }
    if (RAW_TAGS.has(el.tag)) return;
    el.children = el.children.flatMap((child): Node[] => {
      if (child.type === "element") {
        visit(child);
        return [child];
      }
      if (child.type === "text") return expandDollars(child.text, el.pos);
      return [child];
    });
  }

  /** Splits prose into text and rendered `$…$` / `$$…$$` segments. */
  function expandDollars(text: string, pos?: Position): Node[] {
    const nodes: Node[] = [];
    let plain = "";
    let i = 0;
    const flush = (): void => {
      if (plain) nodes.push({ type: "text", text: plain });
      plain = "";
    };

    while (i < text.length) {
      const ch = text[i];
      if (ch === "\\" && text[i + 1] === "$") {
        plain += "$";
        i += 2;
        continue;
      }
      if (ch === "$") {
        const closer = text[i + 1] === "$" ? "$$" : "$";
        const open = i + closer.length;
        const close = findCloser(text, open, closer);
        if (close === -1) {
          warn(ctx, `unbalanced ${closer} — write \\$ for a literal dollar`, pos);
          plain += ch;
          i++;
          continue;
        }
        flush();
        nodes.push(render(text.slice(open, close), closer === "$$", pos));
        i = close + closer.length;
        continue;
      }
      plain += ch;
      i++;
    }
    flush();
    return nodes;
  }

  /**
   * Renders LaTeX to HTML via KaTeX. A LaTeX error is an error: the source text is emitted as fallback.
   * 
   * @param latex - the LaTeX string to render
   * @param displayMode - whether to render in display mode (true) or inline mode (false)
   * @param pos - the position in the source document (for diagnostics)
   * @returns - a Node representing the rendered HTML or a text node with the original LaTeX if rendering fails
   */
  function render(latex: string, displayMode: boolean, pos?: Position): Node {
    ctx.mathUsed = true;
    try {
      return { type: "raw", html: katex.renderToString(latex, { displayMode }) };
    } catch (e) {
      error(ctx, `KaTeX: ${e instanceof Error ? e.message : String(e)}`, pos);
      return { type: "text", text: latex };
    }
  }
}
/**
 * Finds the position of the closing delimiter in a LaTeX string.
 * @param text - the text to search within
 * @param from - the starting position to search from
 * @param closer - the closing delimiter to find
 * @returns the position of the closing delimiter, or -1 if not found
 */
function findCloser(text: string, from: number, closer: string): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text.startsWith(closer, i)) return i;
  }
  return -1;
}
