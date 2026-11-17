/**
 * The browser side of Delta. The compiler ships data (num attributes, ids,
 * pre-rendered math); these elements render the chrome. The runtime is inlined
 * at the end of <body>, so the whole tree is parsed before anything upgrades.
 * Everything here must work offline — no fetch, no external resources.
 *
 * One element (or cohesive group) per file; each module exports a `defineX()`
 * that registers its tags. This aggregator calls them in registration order.
 *
 * The order matters. `customElements.define` upgrades every existing element of that
 * tag at once, in document order, so an element defined earlier has already built its
 * chrome when a later one runs. Four constraints follow; everything else is free:
 *
 *   1. defineSlide() right after defineSections(): in a presentation a section turns its
 *      title into a new <delta-slide>, which must upgrade before the deck collects slides.
 *   2. The collaboration elements (comment … change) after sections and environments: a
 *      comment anchored with on="id" moves itself into the target's heading or box tag,
 *      which must already exist.
 *   3. defineReview() last: the panel reads state every other element has finished.
 *   4. defineAnimation() after the layout elements (list, columns, box): a board reads the
 *      chrome they built to find its steps, and the deck then asks each board how many
 *      steps it has.
 *
 * A new element with no such dependency goes anywhere before defineAnimation().
 */

import { defineSections } from "./section.ts";
import { defineSlide } from "./slide.ts";
import { defineEnvironments } from "./environment.ts";
import { defineProofStructure } from "./proofstructure.ts";
import { defineDocument } from "./document.ts";
import { defineSidenote } from "./sidenote.ts";
import { defineMedia } from "./media.ts";
import { defineHint } from "./hint.ts";
import { defineToc } from "./toc.ts";
import { defineFloating } from "./floating.ts";
import { defineLink } from "./link.ts";
import { defineRef } from "./ref.ts";
import { defineBibliography } from "./bibliography.ts";
import { defineCite } from "./cite.ts";
import { defineCode } from "./code.ts";
import { defineList } from "./list.ts";
import { defineTable } from "./table.ts";
import { defineColumns } from "./columns.ts";
import { defineFrontMatter } from "./frontmatter.ts";
import { defineBox } from "./box.ts";
import { defineAnimation } from "./animation.ts";
import { defineComment } from "./comment.ts";
import { defineTodo } from "./todo.ts";
import { defineDraft } from "./draft.ts";
import { defineChange } from "./change.ts";
import { defineReview } from "./review.ts";

// The in-math \ref markers are not an element, but they share <ref>'s pop-over and jump, so
// they live in ref.ts. Re-exported so the entry point reaches elements/ through this file only.
export { wireMathRefs } from "./ref.ts";

export function defineComponents(): void {
  defineDocument();
  defineSections();
  defineSlide(); // (1) right after sections
  defineEnvironments();
  defineProofStructure();
  defineSidenote();
  defineMedia();
  defineHint();
  defineToc();
  defineFloating();
  defineLink();
  defineRef();
  defineBibliography();
  defineCite();
  defineCode();
  defineList();
  defineTable();
  defineColumns();
  defineFrontMatter();
  defineBox();
  defineAnimation(); // (4) after the layout elements it walks into
  // (2) collaboration elements: after the headings and box tags they anchor into.
  defineComment();
  defineTodo();
  defineDraft();
  defineChange();
  defineReview(); // (3) last: it reads state every other element has finished building
}
