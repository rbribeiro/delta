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
 * chrome when a later one runs. Three constraints follow; everything else is free:
 *
 *   1. defineSlide() right after defineSections(): in a presentation a section turns its
 *      title into a new <delta-slide>, which must upgrade before the deck collects slides.
 *   2. The collaboration elements (comment … change) after sections and environments: a
 *      comment anchored with on="id" moves itself into the target's heading or box tag,
 *      which must already exist.
 *   3. defineReview() last: the panel reads state every other element has finished.
 *
 * A new element with no such dependency goes anywhere before the collaboration block.
 */

import { defineSections } from "./section";
import { defineSlide } from "./slide";
import { defineEnvironments } from "./environment";
import { defineProofStructure } from "./proofstructure";
import { defineDocument } from "./document";
import { defineSidenote } from "./sidenote";
import { defineMedia } from "./media";
import { defineHint } from "./hint";
import { defineToc } from "./toc";
import { defineFloating } from "./floating";
import { defineLink } from "./link";
import { defineRef } from "./ref";
import { defineBibliography } from "./bibliography";
import { defineCite } from "./cite";
import { defineCode } from "./code";
import { defineList } from "./list";
import { defineTable } from "./table";
import { defineColumns } from "./columns";
import { defineFrontMatter } from "./frontmatter";
import { defineBox } from "./box";
import { defineComment } from "./comment";
import { defineTodo } from "./todo";
import { defineDraft } from "./draft";
import { defineChange } from "./change";
import { defineReview } from "./review";

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
  // (2) collaboration elements: after the headings and box tags they anchor into.
  defineComment();
  defineTodo();
  defineDraft();
  defineChange();
  defineReview(); // (3) last: it reads state every other element has finished building
}
