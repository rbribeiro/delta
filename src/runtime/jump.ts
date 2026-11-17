/**
 * Jumping to a target the way every Delta link does: in a deck, page to its slide; otherwise
 * unfold, scroll and flash it. Also the pop-over snapshots (`templateFor`) a jump previews.
 */

import { getDeck } from "./deck.ts";
import { unfoldAncestors } from "./fold.ts";

/** Unfolds, smooth-scrolls to and flashes `#id` (the shared `.is-xref-target` animation). */
export function flashTarget(id: string, block: ScrollLogicalPosition = "center"): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  unfoldAncestors(target);
  target.scrollIntoView({ block, behavior: "smooth" });
  target.classList.add("is-xref-target");
  target.addEventListener("animationend", () => target.classList.remove("is-xref-target"), {
    once: true,
  });
  return true;
}

/**
 * Jumps to `#id` in this page the way every Delta link does: in a deck, pages to the
 * target's slide; otherwise unfolds, scrolls and flashes it. False when there is no such
 * element (the caller can then let the browser try).
 */
export function jumpTo(id: string, block: ScrollLogicalPosition = "center"): boolean {
  if (getDeck()?.goToId(id)) return true;
  return flashTarget(id, block);
}

/**
 * Makes a link (its `href` already `file#id` or `#id`) jump like every Delta link: to
 * another output (`file` set) the browser navigates; in-page it is `jumpTo`. `before`
 * runs first on every click (closing the pop-over the link sits in); `address` puts
 * `#id` in the address bar after an in-page jump, so the URL can be shared.
 */
export function linkJump(
  a: HTMLAnchorElement,
  id: string,
  file?: string | null,
  {
    block = "center",
    before,
    address = false,
  }: { block?: ScrollLogicalPosition; before?: () => void; address?: boolean } = {},
): void {
  a.addEventListener("click", (e) => {
    before?.();
    if (file) return;
    if (!jumpTo(id, block)) return;
    e.preventDefault();
    if (address) rememberAddress(id);
  });
}

/** Puts `#id` in the address bar after an in-page jump (a deck keeps its slide number). */
export function rememberAddress(id: string): void {
  if (getDeck()) return;
  history.replaceState(history.state, "", `#${id}`);
}

/** The inert `<template data-delta-pop="id">` snapshot the compiler shipped for `id`. */
export function templateFor(id: string): HTMLTemplateElement | undefined {
  templates ??= new Map(
    [...document.querySelectorAll<HTMLTemplateElement>("template[data-delta-pop]")].map((tpl) => [
      tpl.dataset.deltaPop ?? "",
      tpl,
    ]),
  );
  return templates.get(id);
}
let templates: Map<string, HTMLTemplateElement> | undefined;
