import { elements, textContent, walk, type ElementNode } from "./ast.ts";
import { warn, type CompileContext } from "./context.ts";
import { ACTION_TAGS, ENTERS, MATH_TAGS, NOTE_MARKS, NOTE_SIDES } from "../language/tags.ts";

/**
 * `<animation>`: a board that builds itself step by step. Everything it does happens in
 * the browser (runtime/animation/); the compiler only passes the tags through. This pass
 * is the author's spell-check, and all it does is warn:
 *
 *   - an action (`<pause/>`, `<morph>`, `<hide>`, …) outside a board does nothing;
 *   - `target="id"` must name something on the same board, and `part="name"` a piece that
 *     the target (or a `<morph>` of it) names with `\part{name}{…}`;
 *   - a `<morph>` replaces a display formula (`<equation>` or `<math>`);
 *   - `mark`, `side`, `enter` and the durations take the values the runtime understands.
 *
 * A mistake here would otherwise show only as a step that silently does nothing. Runs in
 * the collab phase: the tree is whole (includes are resolved) and math is still TeX.
 */
export function checkAnimations(doc: ElementNode, ctx: CompileContext): void {
  walk(doc, (el, ancestors) => {
    if (el.tag === "animation") {
      checkBoard(el, ctx);
      return false; // checkBoard has seen everything inside
    }
    // A <note> with no target is just a handwritten line, fine anywhere.
    const needsBoard =
      ACTION_TAGS.has(el.tag) && (el.tag !== "note" || el.attrs.target !== undefined);
    if (needsBoard && !ancestors.some((a) => a.tag === "animation")) {
      warn(ctx, `<${el.tag}> only works inside an <animation>`, el.pos);
    }
  });
}

/** Tags a `<morph>` can replace: the display formulas with one line. */
const MORPHABLE = new Set(["equation", "math"]);
/** Actions that name a target (a `<note>` may also stand alone). */
const TARGETED = new Set(["morph", "note", "hide", "show", "set"]);
/** Attributes of a `<set>` that are about the action, not values to set. */
const SET_OWN = new Set(["target", "duration", "id"]);

const PART = /\\part\s*\{([^}]*)\}/g;
const DURATION = /^\s*\d*\.?\d+\s*(ms|s)?\s*$/;
const list = (values: ReadonlySet<string>): string => [...values].join(", ");

function checkBoard(board: ElementNode, ctx: CompileContext): void {
  const inside = [...elements(board)].filter((el) => el !== board);

  // What an action can name: every id on the board, and the pieces each formula names
  // (a morph's pieces count for the equation it replaces).
  const byId = new Map<string, ElementNode>();
  for (const el of inside) if (el.attrs.id) byId.set(el.attrs.id, el);
  const parts = new Map<string, Set<string>>();
  for (const el of inside) {
    if (!MATH_TAGS.has(el.tag)) continue;
    const owner = el.tag === "morph" ? el.attrs.target : el.attrs.id;
    if (!owner) continue;
    const names = parts.get(owner) ?? new Set<string>();
    for (const m of textContent(el).matchAll(PART)) names.add(m[1].trim());
    parts.set(owner, names);
  }

  const oneOf = (el: ElementNode, attr: string, allowed: ReadonlySet<string>): void => {
    const value = el.attrs[attr];
    if (value !== undefined && !allowed.has(value)) {
      warn(ctx, `<${el.tag}> has unknown ${attr} "${value}" (expected ${list(allowed)})`, el.pos);
    }
  };
  const time = (el: ElementNode, attr: string): void => {
    const value = el.attrs[attr];
    if (value !== undefined && !DURATION.test(value)) {
      warn(
        ctx,
        `<${el.tag}> has an unreadable ${attr} "${value}" (write 1.5s, 800ms or 2)`,
        el.pos,
      );
    }
  };

  oneOf(board, "enter", ENTERS);
  for (const el of inside) {
    if (el.tag === "animation") {
      warn(ctx, "<animation> inside an <animation>: a board cannot hold another board", el.pos);
    }
    oneOf(el, "enter", ENTERS);
    if (!ACTION_TAGS.has(el.tag)) continue;
    time(el, el.tag === "pause" ? "for" : "duration");
    if (!TARGETED.has(el.tag)) continue;

    const id = el.attrs.target;
    if (id === undefined) {
      if (el.tag !== "note") warn(ctx, `<${el.tag}> needs a target="id"`, el.pos);
      continue;
    }
    const target = byId.get(id);
    if (!target) {
      warn(ctx, `<${el.tag}> targets "${id}", which is not on this board`, el.pos);
      continue;
    }
    const part = el.attrs.part;
    if (part !== undefined && !parts.get(id)?.has(part)) {
      warn(ctx, `<${el.tag}> names part "${part}", but "${id}" has no \\part{${part}}{…}`, el.pos);
    }

    if (el.tag === "morph" && !MORPHABLE.has(target.tag)) {
      warn(
        ctx,
        `<morph> can replace an <equation> or a <math>; "${id}" is a <${target.tag}>`,
        el.pos,
      );
    }
    if (el.tag === "note") {
      oneOf(el, "mark", NOTE_MARKS);
      oneOf(el, "side", NOTE_SIDES);
    }
    if (el.tag === "set" && !Object.keys(el.attrs).some((name) => !SET_OWN.has(name))) {
      warn(
        ctx,
        '<set> sets nothing: give it the attributes to change, as in <set target="p" a="2"/>',
        el.pos,
      );
    }
  }
}
