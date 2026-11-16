/**
 * Delta's tag vocabulary: which tags belong to which family. Pure data with no imports,
 * read by the compiler passes *and* the runtime elements, so every list is written once.
 * A pass that needs "the headings" or "the results" imports the set from here, never
 * from another pass.
 *
 * Adding a theorem-like environment: a row in `environments.ts` (its counter), its tag
 * in RESULT_TAGS or BOX_TAGS below (how it is drawn and what it may carry), and its name
 * in every block of `strings.ts`. Nothing else: the runtime and the passes follow.
 */

/** Sectioning tags → heading level (1 = chapter … 4 = subsubsection). */
export const HEADING_LEVEL: Readonly<Record<string, number>> = {
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
};
export const HEADING_TAGS: ReadonlySet<string> = new Set(Object.keys(HEADING_LEVEL));

/**
 * Results: the statements of the proof graph. They take proofs, reader aids, hypotheses
 * and `status="open"` (a planned result with no proof yet). All are drawn as boxes.
 */
export const RESULT_TAGS: ReadonlySet<string> = new Set([
  "theorem",
  "proposition",
  "lemma",
  "corollary",
  "conjecture",
  "claim",
  "definition",
]);

/** Environments drawn as a bordered box with a label: the results, then the rest. */
export const BOX_TAGS: ReadonlySet<string> = new Set([
  ...RESULT_TAGS,
  "example",
  "counterexample",
  "observation",
  "remark",
  "exercise",
  "problem",
]);

/** Environments drawn inline with an italic lead ("Proof."); proof also gets a QED mark. */
export const PROOF_TAGS: ReadonlySet<string> = new Set(["proof", "solution"]);

/**
 * What each proof-like tag proves: a proof proves a result, a solution solves an exercise
 * or a problem. A proof (or solution) nested in, or right after, what it proves joins its
 * box as a footer (`linkProofs`).
 */
export const PROVES: Readonly<Record<string, ReadonlySet<string>>> = {
  proof: RESULT_TAGS,
  solution: new Set(["exercise", "problem"]),
};

/** Every theorem-like environment; the runtime defines one element per tag. */
export const ENVIRONMENT_TAGS: ReadonlySet<string> = new Set([...BOX_TAGS, ...PROOF_TAGS]);

/** Tags that point at another element: `<ref to>`, `<solution of>`, `<proof of>`. */
export const REF_TAGS: ReadonlySet<string> = new Set(["ref", "solution", "proof"]);

/** `\ref{id}` / `\eqref{id}` inside math: group 1 is the command, group 2 the id. */
export const MATH_REF = /\\(eqref|ref)\{([^}]*)\}/g;

/** Reader aids that fold under a result or a proof step. */
export const AID_TAGS: ReadonlySet<string> = new Set(["intuition", "strategy", "obstacle"]);

/**
 * Tags whose content is LaTeX, rendered by KaTeX at compile time. `<morph>` is the next
 * form of an equation on an `<animation>` board: its TeX is math like any other.
 */
export const MATH_TAGS: ReadonlySet<string> = new Set([
  "m",
  "math",
  "equation",
  "equations",
  "morph",
]);

/**
 * Macros every formula may use, for `<animation>`: `\pause` ends a step in the middle of a
 * formula, and `\part{name}{tex}` names a piece of it (a target for `part="name"`, and what
 * a `<morph>` matches first). Both expand to inert `data-delta-*` spans the runtime reads;
 * KaTeX lays them out as if they were not there.
 */
export const MATH_MACROS: Readonly<Record<string, string>> = {
  "\\pause": "\\htmlData{delta-pause=1}{}",
  "\\part": "\\htmlData{delta-part=#1}{#2}",
};
/** Literal code: no `$`, no `\ref`, no line breaks; highlighted (`<code>`) or not (`<c>`). */
export const LITERAL_TAGS: ReadonlySet<string> = new Set(["code", "c"]);
/** Tags whose text is taken literally (math or code): never `$`-scanned, never walked into. */
export const RAW_TAGS: ReadonlySet<string> = new Set([...MATH_TAGS, ...LITERAL_TAGS]);

/** Structural parts of the collaboration vocabulary; never blocks in their own right. */
export const COLLAB_PARTS: ReadonlySet<string> = new Set([
  "reply",
  "old",
  "new",
  "team",
  "member",
  "review",
]);

/**
 * Tags whose *descendants* are neither numbered nor registered: collaboration markup
 * that a `--final` build removes (`comment`, `todo`) or rejects (`old`). An equation
 * quoted inside a comment must not shift the paper's numbering between the review build
 * and the final one. The element itself is still numbered and registered (comments and
 * tasks carry their own counters).
 */
export const OPAQUE: ReadonlySet<string> = new Set(["comment", "todo", "old"]);

/** Collaboration wrappers that structural checks look through (`<change><new><intuition>`). */
export const TRANSPARENT: ReadonlySet<string> = new Set(["change", "new", "old", "draft"]);

/**
 * Block-level tags: a `<change>` wrapping one of these (directly, or inside its
 * `<old>`/`<new>`) is a block change and renders as such (`block="true"`).
 */
export const BLOCK_TAGS: ReadonlySet<string> = new Set([
  ...HEADING_TAGS,
  ...ENVIRONMENT_TAGS,
  "equation",
  "equations",
  "figure",
  "video",
  "youtube",
  "audio",
  "table",
  "code",
  "list",
  "box",
  "columns",
  "draft",
  "todo",
  "abstract",
  "interactive",
  "animation",
]);

/**
 * What happens on an `<animation>` board besides content appearing in document order:
 * `<pause/>` ends a step, the others act on something already there (`target="id"`).
 */
export const ACTION_TAGS: ReadonlySet<string> = new Set([
  "pause",
  "together",
  "morph",
  "note",
  "hide",
  "show",
  "set",
]);
/** The hand-drawn marks a `<note mark="…">` can put on its target. */
export const NOTE_MARKS: ReadonlySet<string> = new Set([
  "circle",
  "box",
  "underline",
  "cross",
  "arrow",
]);
/** Where a note's text sits relative to its target. */
export const NOTE_SIDES: ReadonlySet<string> = new Set(["top", "right", "bottom", "left"]);
/** How a piece of the board comes in. */
export const ENTERS: ReadonlySet<string> = new Set(["write", "fade", "none"]);
