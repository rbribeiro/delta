/**
 * The values the collaboration attributes accept (compiler/collab.ts warns on anything else,
 * so an agent's typo reads as a diagnostic). A block's `status` is the trust vocabulary, in
 * trust.ts. Like the rest of src/language/, this file imports nothing.
 */

/** A `<comment>`'s `status`. */
export const COMMENT_STATUS: ReadonlySet<string> = new Set(["open", "resolved"]);

/** A `<todo>`'s `status`. */
export const TODO_STATUS: ReadonlySet<string> = new Set(["open", "doing", "done"]);

/** A `<todo>`'s `priority`. */
export const PRIORITY: ReadonlySet<string> = new Set(["high", "normal", "low"]);

/** A `<member>`'s `kind`. */
export const MEMBER_KINDS: ReadonlySet<string> = new Set(["human", "agent"]);
