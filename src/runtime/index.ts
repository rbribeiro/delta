import { defineComponents } from "./elements";
import { flashTarget } from "./elements/shared";
import { popover } from "./utils";
import {t} from "./i18n"

declare global {
  interface Window {
    Delta: { popover: typeof popover,
      t: typeof t
     };
  }
}

defineComponents();

// Expose the shared popover controller so components (and authors) can reuse it.
window.Delta = { popover: popover, t: t };

// A cross-file <ref>/<cite> jump lands on `other.html#id`; flash the target on
// arrival so it reads like an in-page jump (and reaches runtime-built anchors,
// e.g. a bibliography <li id>, that the browser's native hash-scroll missed).
const flashHash = (): void => {
  if (location.hash.length > 1) flashTarget(decodeURIComponent(location.hash.slice(1)));
};
flashHash();
window.addEventListener("hashchange", flashHash);
