import katex from "katex";
import { textContent, type ElementNode, type Node, type Position } from "./ast";
import { error, warn, type CompileContext } from "./context";
import { RAW_TAGS, escapeAttr, findMathEnd } from "./preprocess";

/** Tags whose content is LaTeX, rendered at compile time. */
const MATH_TAGS = new Set(["m", "math", "equation", "equations"]);

/** `\ref{id}` / `\eqref{id}` inside math — resolved against ctx.registry at render time. */
const REF_RE = /\\(eqref|ref)\{([^}]*)\}/g;
/** The marker KaTeX renders for the k-th \ref of a formula, swapped for its real attributes. */
const REF_MARK = /data-delta-ref="(\d+)"/g;

/**
 * Renders all math to HTML at compile time — KaTeX itself never ships to the
 * browser, only its CSS does. Covers MATH_TAGS plus `$…$` / `$$…$$` in prose,
 * and unescapes `\$`. Non-math RAW_TAGS (code) are left untouched. A LaTeX error
 * is an error: the source text is emitted as fallback. (see `render()` below)
 *
 * `\ref{id}` / `\eqref{id}` inside math work like `<ref to="id">`: numbering runs
 * before this pass, so the target's number is substituted here (bare for \ref,
 * parenthesized for \eqref) wrapped in a `\htmlData` span carrying the link
 * metadata; the runtime (`wireMathRefs` in elements/ref.ts) makes it clickable
 * with the same popover/jump as <ref>. KaTeX `trust` is enabled for `\htmlData`
 * only. On the project path `idToFile` bakes the cross-file href (a RawNode is a
 * finished HTML string, so annotateCrossFileRefs can't touch it later).
 */

/**
 * Renders all math elements in the document to HTML using KaTeX.
 * @param doc - the root element of the document
 * @param ctx - the compilation context
 * @param idToFile - project path only: id → home output name, for cross-file \ref hrefs
 */
export function renderMath(
  doc: ElementNode,
  ctx: CompileContext,
  idToFile?: Map<string, string>,
): void {
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
        const close = findMathEnd(text, open, closer);
        if (close === -1) {
          // The preprocessor already reported a stray `$` in the source; this is the safety net.
          warn(ctx, `unbalanced ${closer} — write \\$ for a literal dollar`, pos);
          plain += closer;
          i = open;
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
      const refs: string[] = [];
      const expanded = expandMathRefs(latex, refs, pos);
      const html = katex.renderToString(expanded, {
        displayMode,
        // Scoped trust: only the \htmlData spans our \ref expansion emits (inert
        // data attributes) — no \href/\includegraphics/etc. The matching strict
        // handler silences KaTeX's "HTML extension" nag for that one feature.
        trust: (c) => c.command === "\\htmlData",
        strict: (code: string) => (code === "htmlExtension" ? "ignore" : "warn"),
      });
      return { type: "raw", html: html.replace(REF_MARK, (_m, k: string) => refs[Number(k)]), kind: "math" };
    } catch (e) {
      error(ctx, `KaTeX: ${e instanceof Error ? e.message : String(e)}`, pos);
      return { type: "text", text: latex };
    }
  }

  /**
   * Expands `\ref{id}` / `\eqref{id}` into the target's number wrapped in a
   * `\htmlData{delta-ref=k}` marker span the runtime wires up like a <ref>. The id never
   * goes through KaTeX (a `%` or `,` in it would break the formula): `refs[k]` holds the
   * span's real `data-delta-ref-*` attributes, swapped in after rendering. An unresolved id
   * warns and renders as `??` (the LaTeX convention).
   */
  function expandMathRefs(latex: string, refs: string[], pos?: Position): string {
    return latex.replace(REF_RE, (_match, cmd: string, id: string) => {
      const entry = ctx.registry.get(id);
      if (!entry) {
        warn(ctx, `Unresolved reference ${id}`, pos);
        return "\\text{??}";
      }
      const label = cmd === "eqref" ? `(${entry.num})` : entry.num;
      ctx.referencedIds.add(id); // emit snapshots the target into a <template>
      const home = idToFile?.get(id);
      const attrs: [string, string][] = [["to", id], ["num", entry.num], ["tag", entry.tag]];
      if (home && home !== ctx.outName) attrs.push(["href", `${home}#${id}`]);
      refs.push(attrs.map(([k, v]) => `data-delta-ref-${k}="${escapeAttr(v)}"`).join(" "));
      return `\\htmlData{delta-ref=${refs.length - 1}}{\\text{${label}}}`;
    });
  }
}
