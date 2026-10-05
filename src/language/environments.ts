/**
 * Numbering is data-driven, LaTeX style. Each numbered tag maps to a counter; tags
 * may share one like equation and equations. Each counter may be prefixed by another counter, like section numbers being prefixed by chapter numbers. The numbering pass is responsible for incrementing counters and resetting child counters when a parent counter increments.
 *
 * `counter` names a counter that is incremented whenever this tag is encountered. Tags sharing a counter are numbered together.
 * `prefixWith` names a counter whose displayed number is prepended ("2.3"), skipped
 * while that counter is still 0. COUNTER_RESETS (derived from `prefixWith`) restarts child
 * counters whenever a parent counter increments. Adding a numbered environment is a row
 * here, so the numbering pass needs no changes.
 */

export interface EnvironmentSpec {
  /** Counter this tag increments; tags sharing a counter number together. */
  counter: string;
  /** Counter whose displayed number prefixes this one. */
  prefixWith?: string;
}
/**
 * An environment is a set of specifications for a numbered tag. The key is the tag name, and the value is an EnvironmentSpec.
 */
export const ENVIRONMENTS: Record<string, EnvironmentSpec> = {
  chapter: { counter: "chapter" },
  section: { counter: "section", prefixWith: "chapter" },
  subsection: { counter: "subsection", prefixWith: "section" },
  subsubsection: { counter: "subsubsection", prefixWith: "subsection" },

  theorem: { counter: "theorem", prefixWith: "section" },
  proposition: { counter: "proposition", prefixWith: "section" },
  lemma: { counter: "lemma", prefixWith: "section" },
  corollary: { counter: "corollary", prefixWith: "section" },
  conjecture: { counter: "conjecture", prefixWith: "section" },
  definition: { counter: "definition", prefixWith: "section" },
  example: { counter: "example", prefixWith: "section" },
  counterexample: { counter: "counterexample", prefixWith: "section" },
  claim: { counter: "claim", prefixWith: "section" },
  observation: { counter: "observation", prefixWith: "section" },
  remark: { counter: "remark", prefixWith: "section" },

  exercise: { counter: "exercise", prefixWith: "section" },
  problem: { counter: "problem", prefixWith: "section" },

  equation: { counter: "equation", prefixWith: "section" },
  equations: { counter: "equation", prefixWith: "section" },
  figure: { counter: "figure", prefixWith: "section" },
  video: { counter: "video", prefixWith: "section" },
  youtube: { counter: "video", prefixWith: "section" },
  audio: { counter: "audio", prefixWith: "section" },
  table: { counter: "table", prefixWith: "section" },

  interactive: { counter: "interactive", prefixWith: "section" },
  code: { counter: "code", prefixWith: "section" },

  // Collaboration items (<comment>, <todo>, <change>): one document/project-wide counter
  // each, no section prefix, never reset — "Comment 3" stays "Comment 3" wherever it sits.
  comment: { counter: "comment" },
  todo: { counter: "todo" },
  change: { counter: "change" },
};

/**
 * Counters reset when a parent counter (key) increments: every counter displayed with
 * the parent's number in front, as LaTeX's `\numberwithin` does. A new section restarts
 * subsections, theorems, equations, …; the numbering pass applies this transitively, so
 * a new chapter restarts those too. Derived from `prefixWith`, so a new row above needs no
 * entry here. Keys and values are *counter* names, not tag names: `equation` covers both
 * `<equation>` and `<equations>`.
 */
export const COUNTER_RESETS: Readonly<Record<string, string[]>> = childCounters();

function childCounters(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const { counter, prefixWith } of Object.values(ENVIRONMENTS)) {
    if (!prefixWith) continue;
    const children = (out[prefixWith] ??= []);
    if (!children.includes(counter)) children.push(counter);
  }
  return out;
}
