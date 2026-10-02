import { elements, hasTag, nearest, titleOf, walk, type ElementNode, type Node } from "./ast";
import {
  warn,
  type CompileContext,
  type ReviewHeading,
  type ReviewItem,
  type ReviewReply,
} from "./context";
import { stringsFor } from "../language/strings";
import { HEADING_LEVEL, HEADING_TAGS, OPAQUE, RAW_TAGS } from "../language/tags";
import { ensureHeadingId, uniqueSlug, type SlugState } from "./toc";
import { changeParts, plainText, proofTarget } from "./paper";

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
function buildReview(doc: ElementNode, ctx: CompileContext): void {
  ctx.review = collectReview(doc, ctx, usedIds(doc, ctx), { auto: 0 });
}

export function buildProjectReview(
  files: { ctx: CompileContext; doc: ElementNode; outName: string }[],
): ReviewItem[] {
  if (!files.some((f) => hasTag(f.doc, "review", { scope: "project" }))) {
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
  for (const el of elements(doc)) if (el.attrs.id) used.add(el.attrs.id);
  return used;
}

/** What the per-kind item builders below share: plain text, a stable id, a localized tag name. */
interface Reader {
  plain: (nodes: Node[]) => string;
  assignId: (el: ElementNode, base: string) => string;
  label: (tag: string) => string;
}

function collectReview(
  doc: ElementNode,
  ctx: CompileContext,
  used: Set<string>,
  state: SlugState,
  file?: string,
): ReviewItem[] {
  const items: ReviewItem[] = [];
  const strings = stringsFor(ctx.lang);
  const label = (tag: string): string => strings[tag] ?? tag.charAt(0).toUpperCase() + tag.slice(1);
  const reader: Reader = {
    label,
    plain: (nodes) => plainText(nodes, ctx, label),
    assignId: (el, base) => {
      if (el.attrs.id) return el.attrs.id;
      const id = uniqueSlug(base || `${el.tag}-${++state.auto}`, used);
      el.attrs.id = id;
      used.add(id);
      return id;
    },
  };

  /** The nearest enclosing heading; its id is materialized only now that an item needs it. */
  const headingOf = (ancestors: readonly ElementNode[]): ReviewHeading | undefined => {
    const h = nearest(ancestors, (a) => HEADING_TAGS.has(a.tag));
    if (!h) return undefined;
    const titleEl = titleOf(h);
    const id = ensureHeadingId(h, used, state);
    return {
      level: HEADING_LEVEL[h.tag],
      num: h.attrs.num ?? "",
      id,
      title: titleEl ? titleEl.children : [],
    };
  };

  walk(doc, (el, ancestors) => {
    if (RAW_TAGS.has(el.tag)) return false;
    const item = el === doc ? undefined : (ITEM_OF[el.tag] ?? statusItem)(el, reader);
    if (item) {
      if (item.on && !ctx.registry.has(item.on)) {
        warn(ctx, `on="${item.on}" does not match any id in the document`, el.pos);
      }
      const heading = headingOf(ancestors);
      if (heading) item.heading = heading;
      if (file) item.file = file;
      items.push(item);
    }
    // A comment's body or a rejected <old> side is not a place where further items live.
    return !OPAQUE.has(el.tag);
  });
  return items;
}

/** The collaboration items, one builder per tag; any other block goes to `statusItem`. */
const ITEM_OF: Record<string, (el: ElementNode, r: Reader) => ReviewItem> = {
  comment: commentItem,
  todo: todoItem,
  change: changeItem,
};

function commentItem(el: ElementNode, r: Reader): ReviewItem {
  const replies: ReviewReply[] = [];
  const body: Node[] = [];
  for (const c of el.children) {
    if (c.type === "element" && c.tag === "reply") {
      replies.push({
        by: c.attrs.by,
        date: c.attrs.date,
        text: r.plain(c.children),
        body: c.children,
      });
    } else body.push(c);
  }
  return {
    kind: "comment",
    id: r.assignId(el, `comment-${el.attrs.num ?? ""}`),
    tag: "comment",
    num: el.attrs.num,
    status: el.attrs.status ?? "open",
    by: el.attrs.by,
    date: el.attrs.date,
    on: el.attrs.on,
    text: r.plain(body),
    body,
    ...(replies.length ? { replies } : {}),
  };
}

function todoItem(el: ElementNode, r: Reader): ReviewItem {
  return {
    kind: "todo",
    id: r.assignId(el, `todo-${el.attrs.num ?? ""}`),
    tag: "todo",
    num: el.attrs.num,
    status: el.attrs.status ?? "open",
    by: el.attrs.by,
    for: el.attrs.for,
    due: el.attrs.due,
    priority: el.attrs.priority ?? "normal",
    on: el.attrs.on,
    text: r.plain(el.children),
    body: el.children,
  };
}

function changeItem(el: ElementNode, r: Reader): ReviewItem {
  const parts = changeParts(el);
  const kind = (el.attrs.kind ?? "insert") as ReviewItem["changeKind"];
  const oldText = r.plain(parts.olds.flatMap((o) => o.children));
  const newText = r.plain(parts.news.length ? parts.news.flatMap((n) => n.children) : parts.bare);
  return {
    kind: "change",
    id: r.assignId(el, `change-${el.attrs.num ?? ""}`),
    tag: "change",
    num: el.attrs.num,
    status: "pending",
    by: el.attrs.by,
    date: el.attrs.date,
    changeKind: kind,
    note: el.attrs.note,
    text:
      kind === "replace"
        ? `${oldText} ⟶ ${newText}`
        : kind === "delete"
          ? `− ${oldText}`
          : `+ ${newText}`,
    body: el.children,
  };
}

/** Any other block, when it carries `status`, `by` or `verified-by` (a `<draft>`, a proof, a section…). */
function statusItem(el: ElementNode, r: Reader): ReviewItem | undefined {
  const status = el.attrs.status;
  const by = el.attrs.by;
  const verifiedBy = el.attrs["verified-by"];
  if (status === undefined && by === undefined && verifiedBy === undefined) return undefined;
  const titleEl = titleOf(el);
  const name = `${r.label(el.tag)}${el.attrs.num ? ` ${el.attrs.num}` : ""}`;
  const titleText = titleEl ? r.plain(titleEl.children) : "";
  const excerpt = titleEl ? "" : shorten(r.plain(el.children), 160);
  const target = el.tag === "proof" ? proofTarget(el) : undefined;
  return {
    kind: "status",
    id: r.assignId(
      el,
      el.attrs.num ? `${el.tag}-${el.attrs.num}` : target ? `proof-of-${target}` : "",
    ),
    tag: el.tag,
    num: el.attrs.num,
    status: status ?? "unmarked",
    by,
    verifiedBy,
    note: el.attrs.note,
    text: [name, titleText && `(${titleText})`, excerpt && `— ${excerpt}`]
      .filter(Boolean)
      .join(" "),
    body: titleEl ? titleEl.children : [],
  };
}

function shorten(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}
