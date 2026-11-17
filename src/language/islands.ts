/**
 * The JSON islands: what the compiler ships for the runtime as inert
 * `<script type="application/json" id="…">` elements, and the shape of each. Both halves
 * import these types: emit writes `IslandPayload[id]` (src/compiler/emit.ts, `jsonIsland`),
 * and the runtime reads the same type back (src/runtime/island.ts, `readIsland`), so a field
 * added, renamed or retyped on one side fails `tsc` on the other.
 *
 * Like the rest of src/language/, this file imports nothing.
 */

/** A team member, as `<team>` declares it and every author chip shows it. */
export interface ReviewMember {
  id: string;
  name: string;
  kind: "human" | "agent";
  /** A base.css accent palette name (`blue`, `purple`, …), explicit or round-robin assigned. */
  color: string;
}

/** One entry of the table of contents. */
export interface TocEntryData {
  level: number;
  id: string;
  num: string;
  /** The heading's title, serialized HTML (math rendered). */
  title: string;
  /** Set on a project entry whose section lives in another output file. */
  file?: string;
}

/** A reply in a comment thread. */
export interface ReviewReplyData {
  by?: string;
  date?: string;
  text: string;
  /** The reply's body, serialized HTML. */
  html: string;
}

/** The nearest heading above a review item: "where is this?" in the panel. */
export interface ReviewHeadingData {
  level: number;
  num: string;
  id: string;
  /** Serialized HTML. */
  title: string;
}

/** One item the `<review>` panel lists: a comment, a task, a change or a block's status. */
export interface ReviewItemData {
  kind: "comment" | "todo" | "change" | "status";
  id: string;
  /** Source tag: `comment`/`todo`/`change`, or the block's own tag (`proof`, `section`, …). */
  tag: string;
  num?: string;
  status: string;
  by?: string;
  for?: string;
  verifiedBy?: string;
  date?: string;
  due?: string;
  priority?: string;
  changeKind?: "insert" | "delete" | "replace";
  note?: string;
  /** Anchor id (`on="…"`) when the item is attached to another element. */
  on?: string;
  /** Plain text (math kept as `$…$`). */
  text: string;
  /** The item's body, serialized HTML. */
  html: string;
  replies?: ReviewReplyData[];
  heading?: ReviewHeadingData;
  /** Set on a project item that lives in another output file. */
  file?: string;
}

/** The collaboration island: the team, and the items only when the page has a `<review>`. */
export interface ReviewIslandData {
  team: ReviewMember[];
  items?: ReviewItemData[];
}

/** Each island's id and its payload. Adding an island is one line here. */
export interface IslandPayload {
  /** UI strings for the document's language (core's and each pack's), read by `t()`. */
  "delta-i18n": Record<string, string>;
  /** The heading tree `<toc>` renders; absent when the document has no headings. */
  "delta-toc": TocEntryData[];
  /** The team and the review items; absent when nothing on the page reads them. */
  "delta-review": ReviewIslandData;
}

export type IslandId = keyof IslandPayload;
