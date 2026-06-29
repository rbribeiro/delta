/**
 * The browser side of Delta. The compiler ships data (num attributes, ids,
 * pre-rendered math); these elements render the chrome. The runtime is inlined
 * at the end of <body>, so the whole tree is parsed before anything upgrades.
 * Everything here must work offline — no fetch, no external resources.
 *
 * One element (or cohesive group) per file; each module exports a `defineX()`
 * that registers its tags. This aggregator calls them in registration order.
 */

import { defineSections } from "./section";
import { defineSlide } from "./slide";
import { defineEnvironments } from "./environment";
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
import {defineList} from "./list";
import { defineTable } from "./table";
import { defineColumns } from "./columns";
import { defineFrontMatter } from "./frontmatter";

export function defineComponents(): void {
  defineSections();
  defineSlide();
  defineEnvironments();
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
}
