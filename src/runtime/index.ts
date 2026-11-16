import { defineComponents } from "./elements/index.ts";
import { wireMathRefs } from "./elements/ref.ts";
import { setupDeck } from "./deck.ts";
import { followAddress } from "./address.ts";
import { popover } from "./utils.ts";
import { t } from "./i18n.ts";
import { reviewState } from "./elements/collab.ts";

// The type of window.Delta, the contract every pack builds against, is declared in ./api.ts.

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

// The URL hash is the reader's position: arrive at it (a cross-file <ref>/<cite>
// lands on `other.html#id`, a shared link on a deck's `#5`) and, in a deck, keep it
// current, so the editor's live reload lands back in place.
followAddress(deck);
