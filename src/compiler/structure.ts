import { walk, type ElementNode } from "./ast.ts";
import { error, warn, type CompileContext } from "./context.ts";
import { AID_TAGS, OPAQUE, PROOF_TAGS, PROVES, RAW_TAGS, RESULT_TAGS } from "../language/tags.ts";
import { flow, paperParent, proofTarget } from "./paper.ts";

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
 * - A top-level step's own proof folds (the reader sees the claims first; the runtime
 *   draws each step as a pleat of the proof's sheet). Deeper steps never fold: they read
 *   as a list inside their step. The top-level proof learns that it has steps
 *   (`data-step-depth`, how deep they go). An author's `collapsed` wins.
 * - A `<solution>` may have steps too, numbered and named after its exercise.
 * - Hypotheses are numbered H1, H2, … per result; a ref to one reads "(H1)".
 * - A `<proof>` without `of` proves the result right before it, or the one it is nested
 *   in (`linkProofs`), as in a LaTeX paper. A result may have several proofs: the second one's steps are
 *   `<result>-proof2-step-1`, … (`autoIds` counts them across the project).
 * - Inside `<old>`, comments and tasks nothing is numbered, and `<change>`/`<new>`/`<draft>`
 *   are looked through: review and `--final` builds number the same steps and hypotheses.
 *
 * Runs in the collab phase, before numbering: the numbers are written into `num`, which
 * numbering registers like any other. Who uses which hypothesis needs the whole project,
 * so that is the graph's job (graph.ts, `annotateHypotheses`).
 */

/** Where a step may sit: directly in a proof (a step's own proof included). */
const STEP_PARENTS = new Set(["proof", "solution"]);

/** Review notes, which sit between a box and its proof without parting them. */
const NOTES = new Set(["comment", "todo"]);

/**
 * Links each proof to what it proves, and joins the ones the reader sees with it.
 *
 * - A `<proof>` without `of` proves the result right before it: the previous sibling, as
 *   the final paper reads it (`flow`: wrappers looked through, comments and blank text
 *   skipped). It must be a result with an id, or another proof of one (a second proof).
 *   A `<proof>` nested directly in a result proves that result. A `<solution>` works the
 *   same way with an exercise or a problem. Written as `data-of`, not `of`: `of` also
 *   changes the label ("Proof of Theorem 1.1."), and this proof reads plain "Proof.".
 * - A proof (or solution) nested in its target, or right after it in the source (after a
 *   joined proof of the same target counts), gets `data-attached`: the runtime draws it
 *   as the footer of its target's box, folded unless the author said otherwise. The
 *   document's `proofs="open"` (a deck's default) unfolds them all.
 */
export function linkProofs(doc: ElementNode, _ctx: CompileContext): void {
  const open = (doc.attrs.proofs ?? (doc.attrs.type === "presentation" ? "open" : "")) === "open";
  const visit = (el: ElementNode): void => {
    if (RAW_TAGS.has(el.tag)) return;
    const seq = flow(el);
    seq.forEach((n, i) => {
      if (n.type !== "element") return;
      const proves = PROVES[n.tag];
      if (proves && n.attrs.of === undefined && el.tag !== "step") {
        const prev = seq[i - 1];
        const target = proves.has(el.tag)
          ? el.attrs.id
          : prev?.type !== "element"
            ? undefined
            : proves.has(prev.tag)
              ? prev.attrs.id
              : prev.tag === n.tag
                ? proofTarget(prev)
                : undefined;
        if (target) n.attrs["data-of"] = target;
      }
      visit(n);
    });
    if (el.tag !== "step") joinProofs(el, open ? "false" : "true");
  };
  visit(doc);
}

/** Marks `parent`'s proof-like children that join a box: nested in it, or right after it. */
function joinProofs(parent: ElementNode, collapsed: string): void {
  // The previous sibling, blank text skipped, and review notes too (`--final` drops them,
  // and a comment on a theorem must not tear its proof away from it).
  let prev: ElementNode | undefined;
  for (const c of parent.children) {
    if (c.type !== "element") {
      if (c.type !== "text" || /\S/.test(c.text)) prev = undefined;
      continue;
    }
    if (NOTES.has(c.tag)) continue;
    const proves = PROVES[c.tag];
    const target = proofTarget(c);
    // Without an id to link by, a proof still joins the box it sits in or right after.
    const joined =
      proves !== undefined &&
      ((proves.has(parent.tag) && (target === undefined || target === parent.attrs.id)) ||
        (prev !== undefined &&
          ((proves.has(prev.tag) && prev.attrs.id === target) ||
            (prev.tag === c.tag &&
              prev.attrs["data-attached"] === "true" &&
              proofTarget(prev) === target))));
    if (joined) {
      c.attrs["data-attached"] = "true";
      c.attrs.collapsed ??= collapsed;
    }
    prev = c;
  }
}

/** Counts the next auto id for `key` (project-wide, so ids never collide across files). */
function next(autoIds: Map<string, number>, key: string): number {
  const n = (autoIds.get(key) ?? 0) + 1;
  autoIds.set(key, n);
  return n;
}

export function structureProofs(
  doc: ElementNode,
  ctx: CompileContext,
  autoIds = new Map<string, number>(),
): void {
  walk(doc, (el, ancestors) => {
    if (RAW_TAGS.has(el.tag) || OPAQUE.has(el.tag)) return false;
    visit(el, paperParent(ancestors), ctx, autoIds);
  });
}

function visit(
  el: ElementNode,
  parent: ElementNode | undefined,
  ctx: CompileContext,
  autoIds: Map<string, number>,
): void {
  if (el.tag === "proof" && parent?.tag !== "step") {
    // The k-th proof of a result names its steps <result>-proof<k>-step-…; the first keeps <result>-step-….
    const owner = proofTarget(el) ?? el.attrs.id;
    const k = owner ? next(autoIds, `${owner}-proof`) : 1;
    // A proof away from its result gets an id: the result's box links to it.
    if (owner && !el.attrs.id && el.attrs["data-attached"] !== "true" && proofTarget(el))
      el.attrs.id = k === 1 ? `${owner}-proof` : `${owner}-proof${k}`;
    numberSteps(el, "", k === 1 ? owner : `${owner}-proof${k}`, ctx);
  }
  if (el.tag === "solution") {
    // Likewise <exercise>-step-…, then <exercise>-solution2-step-….
    const owner = proofTarget(el) ?? el.attrs.id;
    const k = owner ? next(autoIds, `${owner}-solution`) : 1;
    numberSteps(el, "", k === 1 ? owner : `${owner}-solution${k}`, ctx);
  }
  if (RESULT_TAGS.has(el.tag)) numberHypotheses(el, ctx);
  if (el.tag === "step" && !(parent && STEP_PARENTS.has(parent.tag))) {
    error(
      ctx,
      `<step> must be directly inside a <proof> or <solution> (a step's own <proof> included); found inside <${parent?.tag ?? "document"}>`,
      el.pos,
    );
  }
  // Hypotheses were numbered when their result was visited (above, before its children):
  // one still without a number sits outside any result's statement.
  if (el.tag === "hyp" && el.attrs.num === undefined) {
    error(
      ctx,
      "<hyp> must be in the statement of a result (theorem, lemma, …), not in a proof or an aid",
      el.pos,
    );
  }
  if (el.tag === "counterexample") {
    if (!el.attrs.breaks)
      error(
        ctx,
        '<counterexample> needs breaks="hyp-id": the hypothesis it shows is needed',
        el.pos,
      );
    // An id, so the hypothesis's preview can link to it.
    else if (!el.attrs.id)
      el.attrs.id = `${el.attrs.breaks}-counterexample-${next(autoIds, `${el.attrs.breaks}-counterexample`)}`;
  }
}

/**
 * Numbers the steps of one proof or solution (and, recursively, of each step's proof).
 * Returns the depth of the deepest step.
 */
function numberSteps(
  proof: ElementNode,
  prefix: string,
  owner: string | undefined,
  ctx: CompileContext,
  depth = 1,
): number {
  let deepest = 0;
  let n = 0;
  for (const step of flow(proof)) {
    if (step.type !== "element" || step.tag !== "step") continue;
    const num = `${prefix}${++n}`;
    step.attrs.num = num;
    step.attrs.depth = String(depth);
    if (!step.attrs.id && owner) step.attrs.id = `${owner}-step-${num}`;
    deepest = Math.max(deepest, depth);

    const kids = flow(step).filter((c): c is ElementNode => c.type === "element");
    const claims = kids.filter((c) => c.tag === "claim");
    const proofs = kids.filter((c) => c.tag === "proof");
    if (claims.length === 0)
      error(ctx, `step ${num} has no <claim>: say what the step establishes`, step.pos);
    if (claims.length > 1)
      warn(ctx, `step ${num} has ${claims.length} <claim>s; use one`, step.pos);
    if (proofs.length > 1)
      warn(ctx, `step ${num} has ${proofs.length} <proof>s; use one`, step.pos);
    for (const k of kids) {
      if (k.tag !== "claim" && k.tag !== "proof" && !AID_TAGS.has(k.tag)) {
        warn(
          ctx,
          `<${k.tag}> directly inside step ${num}: put it in the step's <claim> or <proof>`,
          k.pos,
        );
      }
    }
    // <claim> is also a numbered environment (the theorem family's "Claim"). Inside a step it
    // is the step's assertion instead: renamed here, before numbering, so it takes no number
    // and gets no box. Source-based views (show, hashes) still see the author's <claim>.
    for (const c of claims) c.tag = "step-claim";
    const sub = proofs[0];
    if (sub) {
      // A top-level step's proof folds by default: the reader sees the claims first.
      if (depth === 1) {
        sub.attrs.collapsible = "true";
        sub.attrs.collapsed ??= "true";
      }
      deepest = Math.max(deepest, numberSteps(sub, `${num}.`, owner, ctx, depth + 1));
    }
  }
  if (depth === 1 && deepest > 0) proof.attrs["data-step-depth"] = String(deepest);
  return deepest;
}

/** H1, H2, … in document order within one result's statement (aids, `<old>`, comments and tasks excluded). */
function numberHypotheses(result: ElementNode, ctx: CompileContext): void {
  let n = 0;
  const visit = (el: ElementNode): void => {
    for (const c of el.children) {
      if (
        c.type !== "element" ||
        AID_TAGS.has(c.tag) ||
        RESULT_TAGS.has(c.tag) ||
        PROOF_TAGS.has(c.tag) ||
        OPAQUE.has(c.tag)
      )
        continue;
      if (c.tag === "hyp") {
        c.attrs.num = `H${++n}`;
        if (!c.attrs.id)
          warn(
            ctx,
            `hypothesis H${n} has no id: give it one so the proof can say where it is used`,
            c.pos,
          );
      }
      visit(c);
    }
  };
  visit(result);
}
