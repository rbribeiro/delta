/**
 * The URL hash as the reader's position, so a link can point straight at a place and a
 * reload (the editor's live preview rebuilding on save) lands back where the reader was.
 *
 * - A deck writes its slide number, 1-based (`talk.html#5`), on every change; the revealed
 *   fragment count rides along in `history.state`, which a reload keeps but a shared link
 *   does not. Arriving on `#5` pages to slide 5; arriving on `#some-id` pages to the slide
 *   that holds it.
 * - A paper or book writes a section's id when a ToC entry is clicked (`rememberAddress`).
 *   Arriving on `#id` unfolds, scrolls to and flashes it; a reload skips that, since the
 *   browser already restores the scroll position.
 *
 * `replaceState` throughout: the address follows the reader without piling up history.
 */

import type { Deck } from "./deck.ts";
import { flashTarget } from "./elements/shared.ts";

/** The id in the URL hash, decoded ("" when there is none). */
const hashId = (): string => decodeURIComponent(location.hash.slice(1));

export function followAddress(deck: Deck | null): void {
  if (deck) followDeck(deck);
  else followPage();
}

/** Puts `#id` in the address bar after an in-page jump (a deck keeps its slide number). */
export function rememberAddress(id: string): void {
  if (window.Delta?.deck) return;
  history.replaceState(history.state, "", `#${id}`);
}

function followDeck(deck: Deck): void {
  const arrive = (): void => {
    const id = hashId();
    if (/^\d+$/.test(id)) deck.go(Number(id) - 1, history.state?.step ?? 0);
    else if (id) deck.goToId(id);
  };
  arrive();
  // Subscribed after arriving, so the first write records where the hash put us.
  deck.onChange((index) => history.replaceState({ step: deck.step }, "", `#${index + 1}`));
  window.addEventListener("hashchange", arrive);
}

function followPage(): void {
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (hashId() && nav?.type !== "reload") flashTarget(hashId());
  window.addEventListener("hashchange", () => {
    if (hashId()) flashTarget(hashId());
  });
}
