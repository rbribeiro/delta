import { nearest, textContent, type ElementNode, type Node } from "./ast.ts";
import type { CompileContext } from "./context.ts";
import { OPAQUE, TRANSPARENT } from "../language/tags.ts";

/**
 * The tree as the final paper reads it. Collaboration markup wraps the mathematics
 * (`<change><new>…</new></change>`, `<draft>`, a `<comment>` between a theorem and its
 * proof), and several passes must look through it the same way: a proof still follows
 * its theorem, a step is still a step, a title still reads as its text. These are those
 * shared readings. Pure functions of the tree; no pass state.
 */

/**
 * `el`'s children as the final paper reads them: `<change>`, `<new>` and `<draft>` are
 * looked through, `<old>`, comments and tasks are skipped (a `--final` build drops them),
 * and blank text is dropped. So `flow(proof)` lists a proof's steps even when one is
 * wrapped in `<change><new>`.
 */
export function flow(el: ElementNode): Node[] {
  return el.children.flatMap((c): Node[] => {
    if (c.type !== "element") return c.type === "text" && !/\S/.test(c.text) ? [] : [c];
    if (OPAQUE.has(c.tag)) return [];
    return TRANSPARENT.has(c.tag) ? flow(c) : [c];
  });
}

/**
 * The element the paper puts something in: the nearest of its `ancestors` (as `walk` hands
 * them) that is not a collaboration wrapper. A `<step>` in `<proof><change><new>` sits in
 * the proof.
 */
export function paperParent(ancestors: readonly ElementNode[]): ElementNode | undefined {
  return nearest(ancestors, (a) => !TRANSPARENT.has(a.tag));
}

/** The pieces of a `<change>`: its `<old>`/`<new>` children and any loose ("bare") content. */
export interface ChangeParts {
  olds: ElementNode[];
  news: ElementNode[];
  /** Children that are neither `<old>` nor `<new>`: elements, raw nodes, non-blank text. */
  bare: Node[];
}

export function changeParts(el: ElementNode): ChangeParts {
  const parts: ChangeParts = { olds: [], news: [], bare: [] };
  for (const c of el.children) {
    if (c.type === "element" && c.tag === "old") parts.olds.push(c);
    else if (c.type === "element" && c.tag === "new") parts.news.push(c);
    else if (c.type === "text" ? /\S/.test(c.text) : true) parts.bare.push(c);
  }
  return parts;
}

/**
 * What a `<change>` leaves in the paper once accepted: its `<new>` side, or the bare
 * insertion; a deletion (only `<old>`) leaves nothing.
 */
export function acceptedContent(change: ElementNode): Node[] {
  const parts = changeParts(change);
  if (parts.news.length) return parts.news.flatMap((n) => n.children);
  return parts.olds.length ? [] : change.children;
}

/** The result a proof proves: its `of`, or the one `linkProofs` found right before it. */
export function proofTarget(proof: ElementNode): string | undefined {
  return proof.attrs.of ?? proof.attrs["data-of"];
}

/**
 * Plain text of inline content (the CLI report, "copy as text", the page `<title>`):
 * rendered math is read back from KaTeX's TeX annotation as `$…$` / `$$…$$`, a `<ref>`
 * becomes its target's localized label ("Lemma 2.1", straight from the registry),
 * whitespace collapses.
 */
export function plainText(
  nodes: Node[],
  ctx: CompileContext,
  label: (tag: string) => string,
): string {
  let out = "";
  for (const n of nodes) {
    if (n.type === "text") out += n.text;
    else if (n.type === "raw") out += n.kind === "math" ? mathSource(n.html) : "";
    else if (n.tag === "ref") {
      const own = textContent(n).trim();
      const entry = n.attrs.to ? ctx.registry.get(n.attrs.to) : undefined;
      out += own || (entry ? `${label(entry.tag)} ${entry.num}`.trim() : "??");
    } else if (n.tag === "comment" || n.tag === "todo" || n.tag === "reply") {
      continue; // items of their own — a block's excerpt is the block's prose
    } else if (n.tag === "change") {
      out += plainText(acceptedContent(n), ctx, label); // reads as the paper will
    } else out += plainText(n.children, ctx, label);
  }
  return collapseSpace(out);
}

/** Runs of whitespace → one space, trimmed. */
export function collapseSpace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function mathSource(html: string): string {
  const m = /<annotation encoding="application\/x-tex">([\s\S]*?)<\/annotation>/.exec(html);
  if (!m) return "";
  const tex = m[1]
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
  return html.includes("katex-display") ? `$$${tex}$$` : `$${tex}$`;
}
