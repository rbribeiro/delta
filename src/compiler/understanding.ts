import type { ElementNode, Node } from "./ast";
import { error, warn, type CompileContext } from "./context";
import { OPAQUE } from "./numbering";
import { RAW_TAGS } from "./preprocess";

/**
 * The reader aids of a result — `<intuition>` (why it is true), `<strategy>` (how the
 * proof goes) and `<obstacle>` (where the difficulty is). Ownership is structural: an aid
 * belongs to the result (or the proof `<step>`) it is nested in.
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

/** The aids that hang under their owner as dots + drawer. */
export const AID_TAGS = new Set(["intuition", "strategy", "obstacle"]);

/** What an aid may hang on: a result, or one step of a structured proof. */
const AID_OWNERS = new Set([...RESULT_TAGS, "step"]);

/** Collaboration wrappers the placement checks look through (`<change><new><intuition>`). */
export const TRANSPARENT = new Set(["change", "new", "old", "draft"]);

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

export function checkUnderstanding(doc: ElementNode, ctx: CompileContext): void {
  walk(doc, [], ctx);
}

function walk(el: ElementNode, ancestors: ElementNode[], ctx: CompileContext): void {
  if (RAW_TAGS.has(el.tag)) return;
  if (AID_TAGS.has(el.tag)) visitAid(el, ownerOf(ancestors), ctx);
  if (AID_OWNERS.has(el.tag)) checkDuplicates(el, ctx);
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
  if (!owner || !AID_OWNERS.has(owner.tag)) {
    const where = owner ? `<${owner.tag}>` : "the document root";
    error(ctx, `<${el.tag}> must be a direct child of a numbered result (${[...RESULT_TAGS].join(", ")}) or of a <step>; found inside ${where}`, el.pos);
  }
  if (el.attrs.id !== undefined) {
    error(ctx, `<${el.tag}> cannot carry an id: it is not a ref target (put the id on its result)`, el.pos);
    delete el.attrs.id;
  }
  // Hidden until asked for, in every document type: the page shows statements.
  el.attrs.collapsed ??= "true";
}

/** Two intuitions on one result (or step) would be two dots with the same name: warn. */
function checkDuplicates(el: ElementNode, ctx: CompileContext): void {
  const seen = new Set<string>();
  for (const child of el.children) {
    if (child.type !== "element" || !AID_TAGS.has(child.tag)) continue;
    if (seen.has(child.tag)) warn(ctx, `<${el.tag}> has more than one <${child.tag}>; merge them into one`, child.pos);
    seen.add(child.tag);
  }
}
