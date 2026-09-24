import type { ElementNode } from "./ast";
import { error, warn, type CompileContext } from "./context";
import { RAW_TAGS } from "./preprocess";
import { AID_TAGS, RESULT_TAGS } from "./understanding";

/**
 * Structured proofs and hypotheses, the parts of a proof a reader navigates by:
 *
 *   <theorem id="thm:t">
 *     Suppose <hyp id="hyp:c">$c > 1$</hyp> and <hyp id="hyp:n">$n$ is large</hyp>. Then …
 *   </theorem>
 *   <proof of="thm:t">
 *     <step id="st:1">
 *       <claim>…</claim>
 *       <proof>… uses <ref to="hyp:c"/> … <step>…</step> …</proof>
 *     </step>
 *   </proof>
 *
 * - A step's `<claim>` becomes `<step-claim>` (the plain `<claim>` elsewhere stays the
 *   numbered environment it always was).
 * - Steps are numbered by their place in the proof, Lamport-style: 1, 2, then 1.1, 1.2
 *   inside step 1's proof. A step without an id gets one (`<result>-step-1.2`), so every
 *   step is ref-able ("Step 1.2") and addressable by `delta show`.
 * - A step's own proof folds (claims stay visible); the top-level proof learns how deep
 *   its steps go (`data-step-depth`), which the runtime turns into an "expand to level k"
 *   control. An author's `collapsed` wins.
 * - Hypotheses are numbered H1, H2, … per result; a ref to one reads "(H1)".
 *
 * Runs in the collab phase, before numbering: the numbers are written into `num`, which
 * numbering registers like any other. Who uses which hypothesis needs the whole project,
 * so that is the graph's job (graph.ts, `annotateHypotheses`).
 */

/** Where a step may sit: directly in a proof (a step's own proof included). */
const STEP_PARENTS = new Set(["proof"]);

let counterexamples = 0;

export function structureProofs(doc: ElementNode, ctx: CompileContext): void {
  counterexamples = 0;
  walk(doc, null, ctx);
}

function walk(el: ElementNode, parent: ElementNode | null, ctx: CompileContext): void {
  if (RAW_TAGS.has(el.tag)) return;
  if (el.tag === "proof" && parent?.tag !== "step") numberSteps(el, "", el.attrs.of ?? el.attrs.id, ctx);
  if (RESULT_TAGS.has(el.tag)) numberHypotheses(el, ctx);
  if (el.tag === "step" && !(parent && STEP_PARENTS.has(parent.tag))) {
    error(ctx, `<step> must be directly inside a <proof> (a step's own <proof> included); found inside <${parent?.tag ?? "document"}>`, el.pos);
  }
  // Hypotheses were numbered when their result was visited (above, before its children):
  // one still without a number sits outside any result's statement.
  if (el.tag === "hyp" && el.attrs.num === undefined) {
    error(ctx, "<hyp> must be in the statement of a result (theorem, lemma, …), not in a proof or an aid", el.pos);
  }
  if (el.tag === "counterexample") {
    if (!el.attrs.breaks) error(ctx, '<counterexample> needs breaks="hyp-id": the hypothesis it shows is needed', el.pos);
    // An id, so the hypothesis's preview can link to it.
    else if (!el.attrs.id) el.attrs.id = `${el.attrs.breaks}-counterexample-${++counterexamples}`;
  }
  for (const c of el.children) if (c.type === "element") walk(c, el, ctx);
}

/**
 * Numbers the steps of one proof (and, recursively, of each step's proof). Returns the
 * depth of the deepest step, so the top-level proof can offer levels 1…depth.
 */
function numberSteps(proof: ElementNode, prefix: string, owner: string | undefined, ctx: CompileContext, depth = 1): number {
  let deepest = 0;
  let n = 0;
  for (const step of proof.children) {
    if (step.type !== "element" || step.tag !== "step") continue;
    const num = `${prefix}${++n}`;
    step.attrs.num = num;
    step.attrs.depth = String(depth);
    if (!step.attrs.id && owner) step.attrs.id = `${owner}-step-${num}`;
    deepest = Math.max(deepest, depth);

    const kids = step.children.filter((c): c is ElementNode => c.type === "element");
    const claims = kids.filter((c) => c.tag === "claim");
    const proofs = kids.filter((c) => c.tag === "proof");
    if (claims.length === 0) error(ctx, `step ${num} has no <claim>: say what the step establishes`, step.pos);
    if (claims.length > 1) warn(ctx, `step ${num} has ${claims.length} <claim>s; use one`, step.pos);
    if (proofs.length > 1) warn(ctx, `step ${num} has ${proofs.length} <proof>s; use one`, step.pos);
    for (const k of kids) {
      if (k.tag !== "claim" && k.tag !== "proof" && !AID_TAGS.has(k.tag) && k.tag !== "comment" && k.tag !== "todo") {
        warn(ctx, `<${k.tag}> directly inside step ${num}: put it in the step's <claim> or <proof>`, k.pos);
      }
    }
    // <claim> is also a numbered environment (the theorem family's "Claim"). Inside a step it
    // is the step's assertion instead: renamed here, before numbering, so it takes no number
    // and gets no box. Source-based views (show, hashes) still see the author's <claim>.
    for (const c of claims) c.tag = "step-claim";
    const sub = proofs[0];
    if (sub) {
      // A step's proof folds by default: the reader sees the claims first.
      sub.attrs.collapsible = "true";
      sub.attrs.collapsed ??= "true";
      sub.attrs["data-depth"] = String(depth);
      deepest = Math.max(deepest, numberSteps(sub, `${num}.`, owner, ctx, depth + 1));
    }
  }
  if (depth === 1 && deepest > 0) proof.attrs["data-step-depth"] = String(deepest);
  return deepest;
}

/** H1, H2, … in document order within one result's statement (aids excluded). */
function numberHypotheses(result: ElementNode, ctx: CompileContext): void {
  let n = 0;
  const visit = (el: ElementNode): void => {
    for (const c of el.children) {
      if (c.type !== "element" || AID_TAGS.has(c.tag) || RESULT_TAGS.has(c.tag)) continue;
      if (c.tag === "hyp") {
        c.attrs.num = `H${++n}`;
        if (!c.attrs.id) warn(ctx, `hypothesis H${n} has no id: give it one so the proof can say where it is used`, c.pos);
      }
      visit(c);
    }
  };
  visit(result);
}
