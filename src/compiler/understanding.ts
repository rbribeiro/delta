import { walk, type ElementNode } from "./ast.ts";
import { paperParent } from "./paper.ts";
import { error, warn, type CompileContext } from "./context.ts";
import { AID_TAGS, RAW_TAGS, RESULT_TAGS } from "../language/tags.ts";

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

/** What an aid may hang on: a result, or one step of a structured proof. */
const AID_OWNERS = new Set([...RESULT_TAGS, "step"]);

export function checkUnderstanding(doc: ElementNode, ctx: CompileContext): void {
  walk(doc, (el, ancestors) => {
    if (RAW_TAGS.has(el.tag)) return false;
    if (AID_TAGS.has(el.tag)) visitAid(el, paperParent(ancestors), ctx);
    if (AID_OWNERS.has(el.tag)) checkDuplicates(el, ctx);
  });
}

function visitAid(el: ElementNode, owner: ElementNode | undefined, ctx: CompileContext): void {
  if (!owner || !AID_OWNERS.has(owner.tag)) {
    const where = owner ? `<${owner.tag}>` : "the document root";
    error(
      ctx,
      `<${el.tag}> must be a direct child of a numbered result (${[...RESULT_TAGS].join(", ")}) or of a <step>; found inside ${where}`,
      el.pos,
    );
  }
  if (el.attrs.id !== undefined) {
    error(
      ctx,
      `<${el.tag}> cannot carry an id: it is not a ref target (put the id on its result)`,
      el.pos,
    );
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
    if (seen.has(child.tag))
      warn(ctx, `<${el.tag}> has more than one <${child.tag}>; merge them into one`, child.pos);
    seen.add(child.tag);
  }
}
