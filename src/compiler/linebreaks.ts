import type { ElementNode, Node } from "./ast";
import { RAW_TAGS } from "./preprocess";

/**
 * A blank line in the source (a run of two or more newlines, ignoring horizontal
 * whitespace) separates a `\n` that the browser would collapse to a space — so an
 * author who blank-lines two paragraphs apart gets one running block. This regex
 * matches such a run: a newline, optional horizontal whitespace, a second newline,
 * then any trailing whitespace (so several blank lines collapse to one break).
 */
const BLANK_RUN = /\n[^\S\n]*\n\s*/g;
const NONSPACE = /\S/;

/**
 * Rewrites prose `TextNode`s so a blank line in the source becomes a single `<br>`
 * in the output (a tight line break, no paragraph gap). A *single* newline is left
 * untouched — the browser collapses it to a space — so source soft-wrapping is
 * unaffected. Runs of multiple blank lines collapse to one break. Text inside
 * RAW_TAGS elements (math, code, inline `<c>`) is never touched.
 *
 * `RawNode`s carry the literal `<br>`; the emitter writes them verbatim, so no
 * emitter or runtime change is needed.
 *
 * @param doc - the root AST node to transform (mutated in place)
 */
export function resolveLineBreaks(doc: ElementNode): void {
  walk(doc);
}

function walk(el: ElementNode): void {
  if (RAW_TAGS.has(el.tag)) return; // leave math/code/inline-code prose literal
  const out: Node[] = [];
  for (const child of el.children) {
    if (child.type === "text") {
      out.push(...splitText(child.text));
    } else {
      if (child.type === "element") walk(child);
      out.push(child);
    }
  }
  el.children = out;
}

/**
 * Splits a text node on blank-line runs, inserting a `<br>` raw node between the
 * pieces. Whitespace-only pieces at the edges are dropped so no break appears at
 * the start or end of the node; interior pieces are never empty (BLANK_RUN
 * collapses adjacent blanks). When there is no blank line the original text is
 * returned untouched.
 *
 * Note: a blank line that lands exactly on a text-node↔inline-element boundary
 * (the text on one side being whitespace only, e.g. `x\n\n` then `<em>y</em>`)
 * yields no break — the dominant case, a blank line *inside* one prose run, does.
 */
function splitText(text: string): Node[] {
  const pieces = text.split(BLANK_RUN);
  if (pieces.length === 1) return [{ type: "text", text }]; // no blank line → untouched
  while (pieces.length && !NONSPACE.test(pieces[0])) pieces.shift(); // drop leading ws-only edge
  while (pieces.length && !NONSPACE.test(pieces[pieces.length - 1])) pieces.pop(); // drop trailing ws-only edge
  if (pieces.length <= 1) return pieces.length ? [{ type: "text", text: pieces[0] }] : [];
  return pieces.flatMap((p, i) =>
    i === 0
      ? [{ type: "text", text: p } as Node]
      : [{ type: "raw", html: "<br>" } as Node, { type: "text", text: p } as Node],
  );
}
