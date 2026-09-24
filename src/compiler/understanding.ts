import type { ElementNode } from "./ast";
import { error, warn, type CompileContext } from "./context";
import { RAW_TAGS } from "./preprocess";

/**
 * The reader aids of a result — `<intuition>` (why it is true), `<strategy>` (how the
 * proof goes), `<obstacle>` (where the difficulty is) and `<heuristic>` (a non-rigorous
 * argument). Ownership is structural: an aid belongs to the result it is nested in.
 *
 * This pass validates placement (a misplaced aid is an error, not a silently dropped
 * block), refuses `id` (aids are never ref targets, and numbering registers every id),
 * and stamps the fold default the runtime reads: every aid starts hidden, in every
 * document type, so the page shows statements and the reader asks for the rest. An
 * author's own `collapsed="false"` wins. Runs in the collab phase, after includes and before numbering.
 */

/** Results that may carry aids (and `status="open"`: a planned result with no proof yet). */
export const RESULT_TAGS = new Set([
  "theorem", "proposition", "lemma", "corollary", "conjecture", "claim", "definition",
]);

/** The aids that hang under a result as dots + drawer; `<heuristic>` also stands alone. */
export const AID_TAGS = new Set(["intuition", "strategy", "obstacle", "heuristic"]);

/** Where a standalone `<heuristic>` may appear besides a result: proofs and body text. */
const HEURISTIC_PARENTS = new Set([
  ...RESULT_TAGS, "proof", "solution",
  "document", "chapter", "section", "subsection", "subsubsection", "slide",
]);

/** Collaboration wrappers the placement check looks through (`<change><new><intuition>`). */
const TRANSPARENT = new Set(["change", "new", "old", "draft"]);

export function checkUnderstanding(doc: ElementNode, ctx: CompileContext): void {
  walk(doc, [], ctx);
}

function walk(el: ElementNode, ancestors: ElementNode[], ctx: CompileContext): void {
  if (RAW_TAGS.has(el.tag)) return;
  if (AID_TAGS.has(el.tag)) visitAid(el, ownerOf(ancestors), ctx);
  if (RESULT_TAGS.has(el.tag)) checkDuplicates(el, ctx);
  const next = [...ancestors, el];
  for (const child of el.children) {
    if (child.type === "element") walk(child, next, ctx);
  }
}

/** The nearest ancestor that is not a collaboration wrapper. */
function ownerOf(ancestors: ElementNode[]): ElementNode | undefined {
  for (let i = ancestors.length - 1; i >= 0; i--) {
    if (!TRANSPARENT.has(ancestors[i].tag)) return ancestors[i];
  }
  return undefined;
}

function visitAid(el: ElementNode, owner: ElementNode | undefined, ctx: CompileContext): void {
  const where = owner ? `<${owner.tag}>` : "the document root";
  if (el.tag === "heuristic") {
    if (!owner || !HEURISTIC_PARENTS.has(owner.tag)) {
      error(ctx, `<heuristic> must be inside a numbered result, a <proof> or body text (a section); found inside ${where}`, el.pos);
    }
  } else if (!owner || !RESULT_TAGS.has(owner.tag)) {
    error(ctx, `<${el.tag}> must be a direct child of a numbered result (${[...RESULT_TAGS].join(", ")}); found inside ${where}`, el.pos);
  }
  if (el.attrs.id !== undefined) {
    error(ctx, `<${el.tag}> cannot carry an id: it is not a ref target (put the id on its result)`, el.pos);
    delete el.attrs.id;
  }

  const onLens = owner !== undefined && RESULT_TAGS.has(owner.tag);
  // Hidden until asked for, in every document type: the page shows statements.
  el.attrs.collapsed ??= "true";
  // A standalone aid folds with the shared collapsible, which needs the opt-in even when open.
  if (!onLens) el.attrs.collapsible = "true";
}

/** Two intuitions on one result would be two dots with the same name: warn. */
function checkDuplicates(el: ElementNode, ctx: CompileContext): void {
  const seen = new Set<string>();
  for (const child of el.children) {
    if (child.type !== "element" || !AID_TAGS.has(child.tag) || child.tag === "heuristic") continue;
    if (seen.has(child.tag)) warn(ctx, `<${el.tag}> has more than one <${child.tag}>; merge them into one`, child.pos);
    seen.add(child.tag);
  }
}
