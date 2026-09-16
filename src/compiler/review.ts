import { textContent, type ElementNode, type Node } from "./ast";
import { warn, type CompileContext, type ReviewHeading, type ReviewItem, type ReviewReply } from "./context";
import { RAW_TAGS } from "./preprocess";
import { resolveLang, stringsFor } from "./strings";
import { ensureHeadingId, HEADING_LEVEL, uniqueSlug, type SlugState } from "./toc";
import { changeParts, COLLAB_TAGS } from "./collab";

/**
 * Collects the collaboration state of a document into `ctx.review`: every `<comment>`,
 * `<todo>`, `<change>` and every block carrying `status`/`by`/`verified-by` (incl.
 * `<draft>`), each with its number, the people involved, a plain-text rendering (math as
 * `$…$`, refs as "Lemma 2.1") and the nearest enclosing heading. Emit ships the list as
 * the `#delta-review` island for the `<review>` panel; `delta review` prints it — so an
 * agent reads the state of a paper without a browser.
 *
 * Runs after numbering (items carry their numbers, `on=` resolves against the registry)
 * and after the ToC (heading ids). A heading that holds an item but has no `id` gets one
 * here via the ToC's slug helper — only those, so a document without a `<toc>` keeps its
 * other headings untouched. Items missing an `id` get `<tag>-<num>` so the panel can jump.
 *
 * `buildProjectReview` is the multi-file twin (the `buildProjectToc` model): with a
 * `<review scope="project">` anywhere, every file's items are collected into one list,
 * each tagged with its home output; otherwise per-file. It always returns the fully
 * tagged list for `ProjectResult.review` (the CLI).
 */
export function buildReview(doc: ElementNode, ctx: CompileContext): void {
  ctx.review = collectReview(doc, ctx, usedIds(doc, ctx), { auto: 0 });
}

export function buildProjectReview(
  files: { ctx: CompileContext; doc: ElementNode; outName: string }[],
): ReviewItem[] {
  if (!files.some((f) => hasProjectReview(f.doc))) {
    for (const f of files) buildReview(f.doc, f.ctx);
    return files.flatMap((f) => f.ctx.review.map((i) => ({ ...i, file: f.outName })));
  }
  const used = new Set<string>();
  for (const f of files) for (const id of usedIds(f.doc, f.ctx)) used.add(id);
  const state: SlugState = { auto: 0 };
  const list: ReviewItem[] = [];
  for (const f of files) list.push(...collectReview(f.doc, f.ctx, used, state, f.outName));
  for (const f of files) {
    f.ctx.review = list.map((i) => (i.file === f.outName ? { ...i, file: undefined } : i));
  }
  return list;
}

/** Every id in play: registry + papers + any id on any node (incl. ones numbering skipped). */
function usedIds(doc: ElementNode, ctx: CompileContext): Set<string> {
  const used = new Set<string>([...ctx.registry.keys(), ...ctx.papers.keys()]);
  const walk = (el: ElementNode): void => {
    if (el.attrs.id) used.add(el.attrs.id);
    for (const c of el.children) if (c.type === "element") walk(c);
  };
  walk(doc);
  return used;
}

function hasProjectReview(doc: ElementNode): boolean {
  const walk = (el: ElementNode): boolean =>
    (el.tag === "review" && el.attrs.scope === "project") ||
    el.children.some((c) => c.type === "element" && walk(c));
  return walk(doc);
}

/** A heading on the walk stack; its id is materialized only if an item needs it. */
interface StackEntry {
  el: ElementNode;
  level: number;
}

function collectReview(
  doc: ElementNode,
  ctx: CompileContext,
  used: Set<string>,
  state: SlugState,
  file?: string,
): ReviewItem[] {
  const items: ReviewItem[] = [];
  const stack: StackEntry[] = [];
  const strings = stringsFor(resolveLang(ctx.lang));
  const label = (tag: string): string => strings[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);

  const heading = (): ReviewHeading | undefined => {
    const top = stack[stack.length - 1];
    if (!top) return undefined;
    const id = ensureHeadingId(top.el, used, state);
    const titleEl = top.el.children.find(
      (c): c is ElementNode => c.type === "element" && c.tag === "title",
    );
    return { level: top.level, num: top.el.attrs.num ?? "", id, title: titleEl ? titleEl.children : [] };
  };

  const assignId = (el: ElementNode, base: string): string => {
    if (el.attrs.id) return el.attrs.id;
    const id = uniqueSlug(base || `${el.tag}-${++state.auto}`, used);
    el.attrs.id = id;
    used.add(id);
    return id;
  };

  const plain = (nodes: Node[]): string => plainText(nodes, ctx, label);

  const visit = (el: ElementNode): void => {
    if (RAW_TAGS.has(el.tag)) return;

    let item: ReviewItem | undefined;
    switch (el.tag) {
      case "comment": {
        const replies: ReviewReply[] = [];
        const body: Node[] = [];
        for (const c of el.children) {
          if (c.type === "element" && c.tag === "reply") {
            replies.push({ by: c.attrs.by, date: c.attrs.date, text: plain(c.children), body: c.children });
          } else body.push(c);
        }
        item = {
          kind: "comment",
          id: assignId(el, `comment-${el.attrs.num ?? ""}`),
          tag: "comment",
          num: el.attrs.num,
          status: el.attrs.status ?? "open",
          by: el.attrs.by,
          date: el.attrs.date,
          on: el.attrs.on,
          text: plain(body),
          body,
          ...(replies.length ? { replies } : {}),
        };
        break;
      }
      case "todo":
        item = {
          kind: "todo",
          id: assignId(el, `todo-${el.attrs.num ?? ""}`),
          tag: "todo",
          num: el.attrs.num,
          status: el.attrs.status ?? "open",
          by: el.attrs.by,
          for: el.attrs.for,
          due: el.attrs.due,
          priority: el.attrs.priority ?? "normal",
          on: el.attrs.on,
          text: plain(el.children),
          body: el.children,
        };
        break;
      case "change": {
        const parts = changeParts(el);
        const kind = (el.attrs.kind ?? "insert") as ReviewItem["changeKind"];
        const oldText = plain(parts.olds.flatMap((o) => o.children));
        const newText = plain(parts.news.length ? parts.news.flatMap((n) => n.children) : parts.bare);
        const text =
          kind === "replace" ? `${oldText} ⟶ ${newText}` : kind === "delete" ? `− ${oldText}` : `+ ${newText}`;
        item = {
          kind: "change",
          id: assignId(el, `change-${el.attrs.num ?? ""}`),
          tag: "change",
          num: el.attrs.num,
          status: "pending",
          by: el.attrs.by,
          date: el.attrs.date,
          changeKind: kind,
          note: el.attrs.note,
          text,
          body: el.children,
        };
        break;
      }
      default: {
        if (el === doc || COLLAB_TAGS.has(el.tag)) break;
        const status = el.attrs.status;
        const by = el.attrs.by;
        const verifiedBy = el.attrs["verified-by"];
        if (status === undefined && by === undefined && verifiedBy === undefined) break;
        const titleEl = el.children.find(
          (c): c is ElementNode => c.type === "element" && c.tag === "title",
        );
        const name = `${label(el.tag)}${el.attrs.num ? ` ${el.attrs.num}` : ""}`;
        const titleText = titleEl ? plain(titleEl.children) : "";
        const excerpt = titleEl ? "" : shorten(plain(el.children), 160);
        item = {
          kind: "status",
          id: assignId(el, el.attrs.num ? `${el.tag}-${el.attrs.num}` : el.tag === "proof" && el.attrs.of ? `proof-of-${el.attrs.of}` : ""),
          tag: el.tag,
          num: el.attrs.num,
          status: status ?? "unmarked",
          by,
          verifiedBy,
          note: el.attrs.note,
          text: [name, titleText && `(${titleText})`, excerpt && `— ${excerpt}`].filter(Boolean).join(" "),
          body: titleEl ? titleEl.children : [],
        };
      }
    }

    if (item) {
      if (item.on && !ctx.registry.has(item.on)) {
        warn(ctx, `on="${item.on}" does not match any id in the document`, el.pos);
      }
      const h = heading();
      if (h) item.heading = h;
      if (file) item.file = file;
      items.push(item);
    }

    // Headings frame their descendants; a comment's body or a rejected <old> side is not
    // a place where further items live.
    if (el.tag === "comment" || el.tag === "todo" || el.tag === "old") return;
    const level = HEADING_LEVEL[el.tag];
    if (level !== undefined) stack.push({ el, level });
    for (const c of el.children) if (c.type === "element") visit(c);
    if (level !== undefined) stack.pop();
  };

  visit(doc);
  return items;
}

/**
 * Plain text of inline content for the CLI report and "copy as text": rendered math is
 * read back from KaTeX's TeX annotation as `$…$` / `$$…$$`, a `<ref>` becomes its target's
 * localized label ("Lemma 2.1", straight from the registry), whitespace collapses.
 */
export function plainText(nodes: Node[], ctx: CompileContext, label: (tag: string) => string): string {
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
      // A block's excerpt reads as the paper will: the new side (or the bare insertion), not the old.
      const parts = changeParts(n);
      out += plainText(parts.news.length ? parts.news.flatMap((c) => c.children) : parts.olds.length ? [] : n.children, ctx, label);
    } else out += plainText(n.children, ctx, label);
  }
  return out.replace(/\s+/g, " ").trim();
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

function shorten(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
