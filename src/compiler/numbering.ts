import type { ElementNode } from "./ast";
import { COUNTER_RESETS, ENVIRONMENTS, type EnvironmentSpec } from "./environments";
import { warn, type CompileContext } from "./context";

/**
 * Carried counter state. A single document starts fresh; a project threads one
 * state through its files in order so numbering (and the section prefixes that
 * depend on it) continues across files.
 */
export interface NumberingState {
  counters: Record<string, number>;
  display: Record<string, string>;
}

export function freshNumbering(): NumberingState {
  return { counters: {}, display: {} };
}

/**
 * Numbers all elements in the document according to their environment specifications.
 * The function traverses the document tree, assigning numbers to elements based on their environment specifications. It also registers elements with IDs in the compilation context's registry.
 * @param doc - the root element of the document
 * @param ctx - the compilation context
 * @param state - the current numbering state, used to continue numbering across files
 * @returns the updated numbering state
 */
export function numberDocument(
  doc: ElementNode,
  ctx: CompileContext,
  state: NumberingState = freshNumbering(),
): NumberingState {
  const { counters, display } = state;

  const assign = (el: ElementNode, spec: EnvironmentSpec): void => {
    const explicit = el.attrs.num;
    const numbered = el.attrs.numbered === "false" ? false : true;
    // If the author supplied a `num` attribute, we use it as-is and re-seat the counter if it's a plain integer.
    if (explicit !== undefined) {
      const n = Number(explicit);
      if (Number.isInteger(n) && n >= 0) counters[spec.counter] = n;
      display[spec.counter] = explicit;
    } else if (numbered) {
      const next = (counters[spec.counter] ?? 0) + 1;
      counters[spec.counter] = next;
      // Display prefix only if there is a prefix counter and it is non-zero. 
      // This avoids "0.1" for the first theorem in a sectionless document.
      const prefix =
        spec.prefixWith && (counters[spec.prefixWith] ?? 0) > 0
          ? `${display[spec.prefixWith]}.`
          : "";
      el.attrs.num = `${prefix}${next}`;
      display[spec.counter] = el.attrs.num;
    }
    for (const reset of COUNTER_RESETS[spec.counter] ?? []) counters[reset] = 0;
  };

  const register = (el: ElementNode): void => {
    const id = el.attrs.id;
    if (!id) return;
    if (ctx.registry.has(id)) {
      warn(ctx, `duplicate id "${id}"`, el.pos);
      return;
    }
    ctx.registry.set(id, { tag: el.tag, num: el.attrs.num ?? "" });
  };

  const visit = (el: ElementNode): void => {
    for (const child of el.children) {
      if (child.type !== "element") continue;
      const spec = ENVIRONMENTS[child.tag];
      if (spec) assign(child, spec);
      register(child);
      visit(child);
    }
  };

  register(doc);
  visit(doc);
  return state;
}
