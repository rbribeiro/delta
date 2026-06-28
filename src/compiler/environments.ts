/**
 * Numbering is data-driven, LaTeX style. Each numbered tag maps to a counter; tags
 * may share one like equation and equations. Each counter may be prefixed by another counter, like section numbers being prefixed by chapter numbers. The numbering pass is responsible for incrementing counters and resetting child counters when a parent counter increments.
 *
 * `counter` names a counter that is incremented whenever this tag is encountered. Tags sharing a counter are numbered together.
 * `prefixWith` names a counter whose displayed number is prepended ("2.3"), skipped
 * while that counter is still 0. COUNTER_RESETS restarts child counters whenever a
 * parent counter increments. Adding a numbered environment is a row here, so the
 * numbering pass needs no changes.
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

};

/**
 * Counters that are reset when the parent counter (key) increments. For example, when a new section starts, the subsection counter is reset to 0.
 */
export const COUNTER_RESETS: Record<string, string[]> = {
  chapter: ["section"],
  section: ["subsection", "subsubsection", "theorem", "proposition", "lemma", "corollary", "conjecture", "definition", "example", "claim", "observation", "exercise", "problem", "equation", "equations", "figure", "video", "youtube", "audio", "remark"],
  subsection: ["subsubsection"],
};
