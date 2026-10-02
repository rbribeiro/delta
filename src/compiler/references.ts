import { elements, type ElementNode } from "./ast";
import { warn, type CompileContext } from "./context";

/** Tags that point at another element: `<ref to>`, `<solution of>`, `<proof of>`. */
export const REF_TAGS = new Set(["ref", "solution", "proof"]);

/**
 * Resolves `<ref to="id"> <solution of="id"> <proof of="id">` cross-references against the numbering registry
 * (filled by `numberDocument`). For each ref that resolves, the target's number
 * and tag are written onto the node — the runtime composes the visible label
 * ("Theorem 1.1") from them via `t(tag)`, so it localizes — and the target id is
 * recorded in `ctx.referencedIds` so the emitter snapshots it into a
 * `<template data-delta-pop="id">` for the offline pop-over preview.
 *
 * A `<ref>` with no `to`, or any of the three pointing at an unknown id, is a *warning*: the node
 * is left bare and the runtime renders it as inert text (no pop-over). A `<solution>`/`<proof>`
 * without `of` is ordinary (it belongs to the statement it follows) and is skipped silently.
 *
 * @param doc - the root element of the document
 * @param ctx - the compilation context
 */
export function resolveReferences(doc: ElementNode, ctx: CompileContext): void {
  for (const el of elements(doc)) {
    if (!REF_TAGS.has(el.tag)) continue;

    const targetId = el.tag === "ref" ? el.attrs.to : el.attrs.of;
    if (!targetId) {
      if (el.tag === "ref") warn(ctx, "<ref> tag without 'to' attribute", el.pos);
      continue;
    }

    const entry = ctx.registry.get(targetId);
    if (!entry) {
      warn(ctx, `Unresolved reference ${targetId}`, el.pos);
      continue;
    }
    el.attrs["data-target-num"] = entry.num;
    el.attrs["data-target-tag"] = entry.tag;
    ctx.referencedIds.add(targetId);
  }
}
