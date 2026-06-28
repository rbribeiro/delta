import { elements, textContent, type ElementNode } from "./ast";
import type { CompileContext, TocEntry } from "./context";

/**
 * Builds the table-of-contents heading tree consumed by `<delta-toc>`. Walks the
 * document in order collecting every `chapter`/`section`/`subsection`/`subsubsection`
 * with its level, number and title; the runtime renders the nested nav and filters
 * by `depth`, so the full tree is always shipped.
 *
 * A heading without an `id` gets a slug derived from its title assigned back to the
 * node, so the TOC link (`#slug`) and the rendered section anchor agree. This only
 * happens when the document actually uses a `<toc>` — no `<toc>`, no id mutation.
 *
 * `buildProjectToc` is the multi-file twin: when any file carries a
 * `<toc scope="project">`, it slugs and collects *every* file's headings into one
 * book-wide list (each entry tagged with its home output), so a project ToC can list
 * the whole work and link cross-file.
 */
const LEVEL: Record<string, number> = {
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
};

/** Mutable slug counter, threaded so auto-ids stay unique across a project's files. */
interface SlugState {
  auto: number;
}

export function buildToc(doc: ElementNode, ctx: CompileContext): void {
  if (!hasToc(doc)) return;
  // Existing ids (author + numbered + paper keys) so generated slugs never collide.
  const used = new Set<string>([...ctx.registry.keys(), ...ctx.papers.keys()]);
  ctx.toc = collectHeadings(doc, used, { auto: 0 });
}

/**
 * Project-wide ToC. When any file declares a `<toc scope="project">`, every file's
 * headings are slugged (one shared `used` set + `auto` counter → globally unique ids
 * and resolvable cross-file anchors) and collected into one ordered list tagged with
 * each file's output name; that list, with same-file entries' `file` blanked, becomes
 * `ctx.toc` on each file that has any `<toc>`. Otherwise (plain tocs only) it falls
 * back to per-file `buildToc`, i.e. today's behavior with no foreign slugging.
 */
export function buildProjectToc(
  files: { ctx: CompileContext; doc: ElementNode; outName: string }[],
): void {
  if (!files.some((f) => hasProjectToc(f.doc))) {
    for (const f of files) buildToc(f.doc, f.ctx);
    return;
  }

  // The registry/papers are shared across the project, so either file's keys seed
  // the whole global id set.
  const ctx0 = files[0].ctx;
  const used = new Set<string>([...ctx0.registry.keys(), ...ctx0.papers.keys()]);
  const state: SlugState = { auto: 0 };
  const list: TocEntry[] = [];
  for (const f of files) list.push(...collectHeadings(f.doc, used, state, f.outName));

  for (const f of files) {
    if (!hasToc(f.doc)) continue;
    // Blank the file field for this file's own entries so the runtime keeps them
    // in-page; the rest stay tagged for cross-file links.
    f.ctx.toc = list.map((e) => (e.file === f.outName ? { ...e, file: undefined } : e));
  }
}

/**
 * Walks `doc` in order, assigning a slug `id` to any heading missing one (recorded in
 * `used`), and returns one `TocEntry` per heading. `file` tags each entry's home
 * output for a project ToC; omit it for a single document.
 */
function collectHeadings(
  doc: ElementNode,
  used: Set<string>,
  state: SlugState,
  file?: string,
): TocEntry[] {
  const out: TocEntry[] = [];
  for (const el of elements(doc)) {
    const level = LEVEL[el.tag];
    if (level === undefined) continue;

    const titleEl = el.children.find(
      (c): c is ElementNode => c.type === "element" && c.tag === "title",
    );

    let id = el.attrs.id;
    if (!id) {
      id = uniqueSlug(slugify(titleEl ? textContent(titleEl) : "") || `section-${++state.auto}`, used);
      el.attrs.id = id;
    }
    used.add(id);

    out.push({
      level,
      id,
      num: el.attrs.num ?? "",
      title: titleEl ? titleEl.children : [],
      ...(file ? { file } : {}),
    });
  }
  return out;
}

/** True when the document declares any `<toc>` (regardless of scope). */
function hasToc(doc: ElementNode): boolean {
  for (const el of elements(doc)) if (el.tag === "toc") return true;
  return false;
}

/** True when the document declares a `<toc scope="project">`. */
function hasProjectToc(doc: ElementNode): boolean {
  for (const el of elements(doc)) if (el.tag === "toc" && el.attrs.scope === "project") return true;
  return false;
}

/** GitHub-style slug: lowercase, non-alphanumerics → hyphens, trimmed. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Ensure uniqueness by suffixing `-2`, `-3`, … and record the result in `used`. */
function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
