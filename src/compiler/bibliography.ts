import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { elements, type ElementNode } from "./ast";
import { addDep, warn, type CompileContext } from "./context";
import { parse } from "./parse";
import { preprocess } from "./preprocess";

/**
 * Loads the bibliography from the given document (or children `<paper>` elements) and registers the papers in the compiler context.
 * 
 * @param doc the root ElementNode from where we start looking for bibliography tags
 * @param ctx the compiler context to which we add the papers
 */

export function loadBibliography(doc: ElementNode, ctx: CompileContext): void {
  for (const bib of [...elements(doc)].filter((e) => e.tag === "bibliography")) {
    for (const child of bib.children) {
      if (child.type === "element" && child.tag === "paper") addPaper(child, ctx);
    }
    if (bib.attrs.src) loadRefFile(bib.attrs.src, ctx, bib);
    // Database consumed (papers are registered); keep only an optional <title> so the
    // author's custom heading survives. resolveCitations re-adds the cited papers after it.
    const title = bib.children.find((c) => c.type === "element" && c.tag === "title");
    bib.children = title ? [title] : [];
  }
}

export function resolveCitations(doc: ElementNode, ctx: CompileContext): void {
  numberCitations(doc, ctx);
  fillBibliography(doc, ctx);
}

/**
 * Numbers every `<cite>` in `doc` against `ctx.papers`, building `ctx.citedPapers` in first-cite order. Each `<cite>` gets `data-cite-nums` and `data-cite-ids` attributes. Warnings are issued for unknown papers.
 * 
 * @param doc root ElementNode from which we start looking for citations given by the `<cite>` tags
 * @param ctx the compiler context to which we add the referenced paper's id so we can clone the cited paper
 */
export function numberCitations(doc: ElementNode, ctx: CompileContext): void {
  for (const el of elements(doc)) {
    if (el.tag !== "cite") continue;

    const ids = parseIds(el.attrs.papers, el.attrs.paper); // merge paper/papers into a deduped id list
    if (ids.length === 0) {
      warn(ctx, "<cite> without a 'paper'/'papers' attribute", el.pos);
      continue;
    }
    const nums: string[] = [];
    const okIds: string[] = [];
    // loop through the ids, warn on unknown, and build the list of citation numbers and valid ids
    for (const id of ids) {
      if (!ctx.papers.has(id)) {
        warn(ctx, `<cite> references unknown paper "${id}"`, el.pos);
        continue;
      }
      let idx = ctx.citedPapers.indexOf(id);
      if (idx === -1) idx = ctx.citedPapers.push(id) - 1; // first-cite order
      ctx.referencedIds.add(id);
      nums.push(String(idx + 1));
      okIds.push(id);
    }
    if (nums.length === 0) continue; // every id unknown — leave the cite inert
    el.attrs["data-cite-nums"] = nums.join(",");
    el.attrs["data-cite-ids"] = okIds.join(",");
  }
}

/**
 * Find the bibliography element in the document and fill it with the cited papers in order of first citation. Warnings are issued if there are citations but no bibliography element.
 * 
 * @param doc the root ElementNode from which we start looking for the `<bibliography>` tag
 * @param ctx the compiler context
 */
export function fillBibliography(doc: ElementNode, ctx: CompileContext): void {
  if (ctx.citedPapers.length === 0) return;

  const bib = [...elements(doc)].find((e) => e.tag === "bibliography");
  if (!bib) {
    warn(ctx, "citations present but no <bibliography> element to render them");
    return;
  }
    bib.children.push(...ctx.citedPapers.map((id, i) => {
      const paper = ctx.papers.get(id)!;
      paper.attrs.id = id;
      paper.attrs["data-cite-num"] = String(i + 1);
      return paper;
      })
    );
}

/** Register one `<paper>` in `ctx.papers`; warn on a missing or duplicate id. */
function addPaper(el: ElementNode, ctx: CompileContext): void {
  const id = el.attrs.id;
  if (!id) {
    warn(ctx, "<paper> without an 'id' attribute", el.pos);
    return;
  }
  if (ctx.papers.has(id)) {
    warn(ctx, `duplicate paper id "${id}"`, el.pos);
    return;
  }
  ctx.papers.set(id, el);
}

/** Read+parse a `.ref` file (relative to the doc) and register its `<paper>` entries. */
function loadRefFile(src: string, ctx: CompileContext, bib: ElementNode): void {
  if (/^[a-z]+:\/\//i.test(src)) {
    warn(ctx, `bibliography src must be a local path, not a URL: ${src}`, bib.pos);
    return;
  }
  const abs = resolve(dirname(ctx.file), src);
  let text: string;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    warn(ctx, `bibliography file not found: ${src}`, bib.pos);
    return;
  }
  addDep(ctx, abs);
  // Diagnostics from the .ref point at the .ref (mirrors include.ts's file swap).
  const prevFile = ctx.file;
  ctx.file = abs;
  const root = parse(preprocess(text), ctx);
  if (root) {
    for (const el of elements(root)) {
      if (el.tag === "paper") addPaper(el, ctx);
    }
  }
  ctx.file = prevFile;
}

/** Merge `paper` (one id) and `papers` (comma/space list) into an ordered, deduped id list. */
function parseIds(papers?: string, paper?: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [papers, paper].filter(Boolean).join(",").split(/[\s,]+/)) {
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}
