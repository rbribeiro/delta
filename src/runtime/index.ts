import { defineComponents } from "./elements/index.ts";
import { wireMathRefs } from "./elements/ref.ts";
import { flashTarget } from "./elements/shared.ts";
import { setupDeck, type Deck } from "./deck.ts";
import { popover } from "./utils.ts";
import { t } from "./i18n.ts";
import { reviewState } from "./elements/collab.ts";

declare global {
  interface Window {
    Delta: {
      popover: typeof popover;
      t: typeof t;
      deck: Deck | null;
      /** Document-wide review switches: annotations on/off, changes markup/final/original. */
      review: typeof reviewState;
    };
  }
}

defineComponents();

// In-math \ref markers (baked into the KaTeX HTML by the compiler) get the same
// popover/jump as <ref>. The runtime sits at the end of <body>, so all math is parsed.
wireMathRefs();

// Page a presentation deck (no-op for non-presentation docs / decks without slides).
// Runs after defineComponents() so the slides have already upgraded.
const deck = setupDeck();

// Expose the shared popover controller and the deck handle so components (and
// authors) can reuse them.
window.Delta = { popover: popover, t: t, deck: deck, review: reviewState };

// A cross-file <ref>/<cite> jump lands on `other.html#id`; flash the target on
// arrival so it reads like an in-page jump (and reaches runtime-built anchors,
// e.g. a bibliography <li id>, that the browser's native hash-scroll missed).
const flashHash = (): void => {
  if (location.hash.length > 1) flashTarget(decodeURIComponent(location.hash.slice(1)));
};
flashHash();
window.addEventListener("hashchange", flashHash);
