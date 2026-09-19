import type { ElementNode, Node, Position } from "./ast";
import { warn, type CompileContext } from "./context";
import { RAW_TAGS } from "./preprocess";

/**
 * The validation pass for the collaboration vocabulary — `<comment>`/`<reply>`, `<todo>`,
 * `<change>`/`<old>`/`<new>`, and the `status`/`by`/`verified-by` attributes any block may
 * carry (plus `<draft>`). It runs right after includes, before numbering, and does three
 * things: writes the defaults the runtime and the `--final` pass key off (`status="open"`
 * on a comment, `kind="replace"` on a change, …), warns on anything outside the small
 * fixed vocabularies (so an agent's typo reads as a diagnostic, not as silently dropped
 * chrome), and checks every `by`/`for`/`verified-by` against `<team>` when one exists.
 *
 * Numbering (C1…Cn) is a row in environments.ts; collection into the review island is
 * `buildReview` (review.ts), which runs after numbering so items carry their numbers.
 */

const COMMENT_STATUS = new Set(["open", "resolved"]);
const TODO_STATUS = new Set(["open", "doing", "done"]);
const PRIORITY = new Set(["high", "normal", "low"]);
const BLOCK_STATUS = new Set(["draft", "sketch", "review", "verified"]);

/** Tags that are collaboration items themselves (their `status` vocab is their own). */
export const COLLAB_TAGS = new Set(["comment", "todo", "change"]);
/** Structural children of the items above; never blocks in their own right. */
const COLLAB_PARTS = new Set(["reply", "old", "new", "team", "member", "review"]);

/**
 * Block-level tags: a `<change>` wrapping one of these (directly, or inside its
 * `<old>`/`<new>`) is a block change and renders as such (`block="true"`).
 */
const BLOCK_TAGS = new Set([
  "chapter", "section", "subsection", "subsubsection",
  "theorem", "proposition", "lemma", "corollary", "conjecture", "definition", "example",
  "claim", "observation", "remark", "exercise", "problem", "proof", "solution",
  "equation", "equations", "figure", "video", "youtube", "audio", "table", "code",
  "list", "box", "columns", "draft", "todo", "abstract", "interactive",
]);

/** Warn when `id` names nobody in `<team>` (a no-op without a team — `by` is then free text). */
function checkMember(ctx: CompileContext, id: string | undefined, pos: Position | undefined, attr: string): void {
  if (!id || ctx.team.size === 0) return;
  if (!ctx.team.has(id)) warn(ctx, `${attr}="${id}" is not a <member> of the <team>`, pos);
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

export function resolveCollab(doc: ElementNode, ctx: CompileContext): void {
  walk(doc, null, ctx);
}

function walk(el: ElementNode, parent: ElementNode | null, ctx: CompileContext): void {
  if (RAW_TAGS.has(el.tag)) return;
  switch (el.tag) {
    case "comment":
      visitComment(el, parent, ctx);
      break;
    case "reply":
      if (parent?.tag !== "comment") warn(ctx, "<reply> must be inside a <comment>", el.pos);
      checkMember(ctx, el.attrs.by, el.pos, "by");
      break;
    case "todo":
      visitTodo(el, ctx);
      break;
    case "change":
      visitChange(el, ctx);
      break;
    case "old":
    case "new":
      if (parent?.tag !== "change") warn(ctx, `<${el.tag}> must be inside a <change>`, el.pos);
      break;
    default:
      if (!COLLAB_PARTS.has(el.tag)) visitBlock(el, ctx);
  }
  for (const child of el.children) {
    if (child.type === "element") walk(child, el, ctx);
  }
}

function visitComment(el: ElementNode, parent: ElementNode | null, ctx: CompileContext): void {
  el.attrs.status ??= "open";
  if (!COMMENT_STATUS.has(el.attrs.status)) {
    warn(ctx, `<comment> has unknown status "${el.attrs.status}" (expected open or resolved)`, el.pos);
  }
  checkMember(ctx, el.attrs.by, el.pos, "by");
  if (parent?.tag === "title") {
    warn(ctx, '<comment> inside a <title> — place it after the element and anchor it with on="id" instead', el.pos);
  }
}

function visitTodo(el: ElementNode, ctx: CompileContext): void {
  el.attrs.status ??= "open";
  if (!TODO_STATUS.has(el.attrs.status)) {
    warn(ctx, `<todo> has unknown status "${el.attrs.status}" (expected open, doing or done)`, el.pos);
  }
  el.attrs.priority ??= "normal";
  if (!PRIORITY.has(el.attrs.priority)) {
    warn(ctx, `<todo> has unknown priority "${el.attrs.priority}" (expected high, normal or low)`, el.pos);
  }
  checkMember(ctx, el.attrs.for, el.pos, "for");
  checkMember(ctx, el.attrs.by, el.pos, "by");
}

function visitChange(el: ElementNode, ctx: CompileContext): void {
  const parts = changeParts(el);
  if (parts.olds.length > 1) warn(ctx, "<change> has more than one <old>", el.pos);
  if (parts.news.length > 1) warn(ctx, "<change> has more than one <new>", el.pos);
  const hasOld = parts.olds.length > 0;
  const hasNew = parts.news.length > 0;
  const hasBare = parts.bare.length > 0;
  if (hasBare && (hasOld || hasNew)) {
    warn(ctx, "<change> mixes loose content with <old>/<new>; put the new text inside <new>", el.pos);
  }
  if (!hasOld && !hasNew && !hasBare) warn(ctx, "empty <change>", el.pos);

  const inferred = hasOld && hasNew ? "replace" : hasOld ? "delete" : "insert";
  const given = el.attrs.kind;
  if (given !== undefined && given !== inferred) {
    warn(ctx, `<change kind="${given}"> disagrees with its content (${inferred}); using ${inferred}`, el.pos);
  }
  el.attrs.kind = inferred;

  if (el.attrs.block === undefined) {
    const holders = [el, ...parts.olds, ...parts.news];
    const isBlock = holders.some((h) =>
      h.children.some((c) => c.type === "element" && BLOCK_TAGS.has(c.tag)),
    );
    if (isBlock) el.attrs.block = "true";
  }
  checkMember(ctx, el.attrs.by, el.pos, "by");
}

function visitBlock(el: ElementNode, ctx: CompileContext): void {
  if (el.tag === "draft") el.attrs.status ??= "draft";
  const status = el.attrs.status;
  if (status !== undefined && !BLOCK_STATUS.has(status)) {
    warn(ctx, `<${el.tag}> has unknown status "${status}" (expected draft, sketch, review or verified)`, el.pos);
  }
  checkMember(ctx, el.attrs.by, el.pos, "by");
  checkMember(ctx, el.attrs["verified-by"], el.pos, "verified-by");
}
