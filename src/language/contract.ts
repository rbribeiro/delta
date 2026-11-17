/**
 * What the compiler gives the runtime: every attribute a compiler pass writes for an element
 * (or the page) to read, with who writes it and who reads it. The answer to "what does my
 * element receive?", on one page.
 *
 * Rule 1 of the architecture is behind every row: the compiler resolves data (a number, a
 * target, a file), the runtime draws chrome from it. The code keeps its string literals;
 * test/contract.test.ts keeps this table honest. It fails when a `data-*` name written under
 * src/compiler/ is missing here, and when a row's writer or reader no longer mentions it.
 * Files are named relative to src/compiler/ (writers) and src/ (readers).
 *
 * Not listed: attributes the author writes and the compiler only passes through or defaults
 * (`status="open"`, `priority`, `by`, `collapsible` on a section…): those are the author
 * vocabulary, documented on the site.
 */

export interface CompilerAttribute {
  /** The attribute, as it appears in the output. */
  name: string;
  /** The element(s) that carry it. */
  on: string;
  /** The compiler files that write it. */
  writers: string[];
  /** The runtime or CSS files that read it; empty only for a compile-time placeholder. */
  readers: string[];
  /** What it means. */
  means: string;
}

export const COMPILER_ATTRIBUTES: readonly CompilerAttribute[] = [
  // -- numbers ------------------------------------------------------------------------------
  {
    name: "num",
    on: "every numbered element: environments, headings, equations, figures, steps, hypotheses",
    writers: ["numbering.ts", "structure.ts"],
    readers: [
      "runtime/elements/environment.ts",
      "runtime/elements/section.ts",
      "runtime/elements/media.ts",
      "runtime/elements/proofstructure.ts",
    ],
    means: 'its number as printed: "2.3", a step\'s "2.1", a hypothesis\'s "H1"',
  },
  {
    name: "depth",
    on: "<step>",
    writers: ["structure.ts"],
    readers: ["runtime/elements/proofstructure.ts"],
    means: "how deep the step is nested (1 = top level)",
  },

  // -- references ---------------------------------------------------------------------------
  {
    name: "data-target-num",
    on: "<ref>",
    writers: ["references.ts", "crossfile.ts"],
    readers: ["runtime/elements/ref.ts"],
    means: "the target's number, for the link text",
  },
  {
    name: "data-target-tag",
    on: "<ref>",
    writers: ["references.ts"],
    readers: ["runtime/elements/ref.ts"],
    means: 'the target\'s tag, for its localized name ("Theorem")',
  },
  {
    name: "data-target-href",
    on: "<ref>",
    writers: ["crossfile.ts"],
    readers: ["runtime/elements/ref.ts"],
    means: "`file.html#id` when the target lives in another output of the project",
  },
  {
    name: "data-delta-pop",
    on: "<template> (one per referenced id, at the end of <body>)",
    writers: ["emit.ts"],
    readers: ["runtime/jump.ts"],
    means: "the id whose snapshot the template holds, cloned into a preview",
  },
  {
    name: "data-delta-ref",
    on: "an in-math \\ref, inside KaTeX's output, during compilation only",
    writers: ["math.ts"],
    readers: [],
    means: "placeholder index; math.ts swaps it for the data-delta-ref-* attributes below",
  },
  {
    name: "data-delta-ref-to",
    on: "an in-math \\ref or \\eqref (a span in the KaTeX output)",
    writers: ["math.ts"],
    readers: ["runtime/elements/ref.ts"],
    means: "the target's id",
  },
  {
    name: "data-delta-ref-num",
    on: "an in-math \\ref or \\eqref",
    writers: ["math.ts"],
    readers: ["runtime/elements/ref.ts"],
    means: "the target's number",
  },
  {
    name: "data-delta-ref-tag",
    on: "an in-math \\ref or \\eqref",
    writers: ["math.ts"],
    readers: ["runtime/elements/ref.ts"],
    means: "the target's tag",
  },
  {
    name: "data-delta-ref-href",
    on: "an in-math \\ref or \\eqref",
    writers: ["math.ts"],
    readers: ["runtime/elements/ref.ts"],
    means: "`file.html#id` when the target lives in another output",
  },

  // -- citations ----------------------------------------------------------------------------
  {
    name: "data-cite-nums",
    on: "<cite>",
    writers: ["bibliography.ts", "crossfile.ts"],
    readers: ["runtime/elements/cite.ts"],
    means: 'the numbers of the cited papers, in first-cite order ("1,3")',
  },
  {
    name: "data-cite-ids",
    on: "<cite>",
    writers: ["bibliography.ts"],
    readers: ["runtime/elements/cite.ts"],
    means: "the cited papers' ids, parallel to data-cite-nums",
  },
  {
    name: "data-cite-file",
    on: "<cite>",
    writers: ["crossfile.ts"],
    readers: ["runtime/elements/cite.ts"],
    means: "the output that holds the bibliography, when it is another file",
  },

  // -- proofs and the proof graph -----------------------------------------------------------
  {
    name: "data-of",
    on: "<proof>, <solution>",
    writers: ["structure.ts"],
    readers: ["runtime/elements/environment.ts"],
    means: "the id of the result it proves (an implicit `of`, resolved)",
  },
  {
    name: "data-attached",
    on: "<proof>",
    writers: ["structure.ts"],
    readers: ["runtime/elements/environment.ts"],
    means: '"true": the proof is joined to its result\'s box, drawn as its footer',
  },
  {
    name: "data-step-depth",
    on: "<proof>",
    writers: ["structure.ts"],
    readers: ["runtime/elements/environment.ts"],
    means: "how deep its steps go, for the steps control",
  },
  {
    name: "data-proof-at",
    on: "a result whose proof is elsewhere",
    writers: ["proof-links.ts"],
    readers: ["runtime/elements/environment.ts"],
    means: 'the proof\'s id ("Proof in Section 2.3")',
  },
  {
    name: "data-proof-at-tag",
    on: "a result whose proof is elsewhere",
    writers: ["proof-links.ts"],
    readers: ["runtime/elements/environment.ts"],
    means: 'the heading the proof sits under ("section"), or "proof" for the same one',
  },
  {
    name: "data-proof-at-num",
    on: "a result whose proof is elsewhere",
    writers: ["proof-links.ts"],
    readers: ["runtime/elements/environment.ts"],
    means: "that heading's number",
  },
  {
    name: "data-proof-at-href",
    on: "a result whose proof is elsewhere",
    writers: ["proof-links.ts"],
    readers: ["runtime/elements/environment.ts"],
    means: "`file.html#id` when the proof is in another output",
  },
  {
    name: "data-proof",
    on: 'a result with status="open" and no proof',
    writers: ["proof-links.ts"],
    readers: ["runtime/elements/environment.ts"],
    means: '"pending": the box says its proof is still to come',
  },
  {
    name: "status",
    on: "a proof whose verification no longer holds",
    writers: ["graph-marks.ts"],
    readers: ["runtime/status.ts"],
    means: '"stale", replacing the author\'s verified: the stamp shows struck through',
  },
  {
    name: "data-eff",
    on: "<pm-node>, <pm-key> (the proof map)",
    writers: ["proofmap.ts"],
    readers: ["styles/components/proofmap.css"],
    means: "the node's effective trust, which colours it",
  },
  {
    name: "data-own",
    on: "<pm-node>",
    writers: ["proofmap.ts"],
    readers: ["styles/components/proofmap.css"],
    means: "its own trust, when weaker dependencies lower the effective one",
  },
  {
    name: "data-cyclic",
    on: "<pm-node>",
    writers: ["proofmap.ts"],
    readers: ["styles/components/proofmap.css"],
    means: '"true": the node is on a cycle of the proof graph',
  },
  {
    name: "data-stale",
    on: "<pm-node>",
    writers: ["proofmap.ts"],
    readers: ["styles/components/proofmap.css"],
    means: '"true": its verification is stale',
  },

  // -- folding, decks, collaboration, media --------------------------------------------------
  {
    name: "collapsed",
    on: "a proof joined to its box, a top-level step's proof, <intuition>/<strategy>/<obstacle>",
    writers: ["structure.ts", "understanding.ts"],
    readers: ["runtime/fold.ts", "runtime/elements/proofstructure.ts", "runtime/aid.ts"],
    means: "folded when the page opens, unless the author said otherwise",
  },
  {
    name: "collapsible",
    on: "a top-level step's proof",
    writers: ["structure.ts"],
    readers: ["runtime/fold.ts"],
    means: '"true": the reader sees the step\'s claim first and unfolds its proof',
  },
  {
    name: "cover",
    on: "<slide> (from <cover>)",
    writers: ["cover.ts"],
    readers: ["runtime/deck.ts", "styles/components/slide.css"],
    means: '"true": the deck\'s title slide',
  },
  {
    name: "reveal",
    on: 'the children of an animated="true" slide or list',
    writers: ["animated.ts"],
    readers: ["runtime/deck.ts"],
    means: '"true": shown one step at a time',
  },
  {
    name: "kind",
    on: "<change>",
    writers: ["collab.ts"],
    readers: ["runtime/elements/change.ts"],
    means: '"insert", "delete" or "replace", inferred from its <old>/<new>',
  },
  {
    name: "block",
    on: "<change>",
    writers: ["collab.ts"],
    readers: ["runtime/elements/change.ts"],
    means: '"true": the change holds blocks (a lemma), not running text',
  },
  {
    name: "src",
    on: "<figure>",
    writers: ["figures.ts"],
    readers: ["runtime/elements/media.ts"],
    means: "the image, inlined as a data: URI (the output references nothing external)",
  },

  // -- the page -----------------------------------------------------------------------------
  {
    name: "data-type",
    on: "<html>",
    writers: ["emit.ts"],
    readers: ["runtime/deck.ts", "styles/components/slide.css"],
    means: "the document type when it is not article (presentation, book)",
  },
  {
    name: "data-accent",
    on: "<html>",
    writers: ["emit.ts"],
    readers: ["styles/base.css"],
    means: "the document's theme-accent palette",
  },
  {
    name: "data-mode",
    on: "<html>",
    writers: ["emit.ts"],
    readers: ["styles/base.css"],
    means: "theme-mode: dark, or auto (follows the OS)",
  },
];
