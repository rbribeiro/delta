/**
 * `window.Delta`: the whole contract between Delta's runtime and every pack (standard, local
 * or npm). It is assigned by `src/runtime/index.ts` before any pack script runs, so a pack can
 * use it on its first line.
 *
 * This declaration is the single typed statement of that contract. Standard packs
 * (`packs/<name>/`) are type-checked against it without importing anything, because they are
 * part of the same TypeScript program. Each member is permanent once shipped: add one only
 * when a pack needs it, and document it here, in docs/AUTHORING_PACKAGES.md and on the site
 * (site/api.dlt).
 */

import type { popover } from "./utils.ts";
import type { t } from "./i18n.ts";
import type { Deck } from "./deck.ts";
import type { reviewState } from "./elements/collab.ts";

declare global {
  interface Window {
    Delta: {
      /** The shared pop-over controller: one open bubble at a time, anchored to a trigger,
       *  closed on Esc or an outside click. Hovercards, previews, menus. */
      popover: typeof popover;
      /** A localized UI string from the `#delta-i18n` island, for the document's `lang`.
       *  A pack's own keys come from its `strings.json` (prefixed `<pack>.`); always pass a
       *  fallback. */
      t: typeof t;
      /** The presentation deck (`type="presentation"` with slides), else `null`. */
      deck: Deck | null;
      /** The document-wide review switches: annotations on/off, changes markup/final/original. */
      review: typeof reviewState;
    };
  }
}
