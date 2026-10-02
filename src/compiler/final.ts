import { elements, type ElementNode, type Node } from "./ast";
import type { CompileContext } from "./context";
import { RAW_TAGS } from "../language/tags";
import { isChecked } from "../language/trust";
import { acceptedContent } from "./paper";

/** What a `--final` build stripped from one file. */
export interface FinalStats {
  openComments: number;
  openTasks: number;
  /** Blocks whose status is not `verified` (drafts included). */
  unverified: number;
  changesAccepted: number;
}

/**
 * `--final` — the clean publication build. Strips every collaboration mark from the tree
 * so the same `.dlt` that carried the review also ships the paper:
 *
 *   <comment>, <todo>, <review>, <team>   removed (a comment's replies go with it)
 *   <draft>                              unwrapped (its prose stays)
 *   <change>                             accepted: <new> (or the bare insertion) stays, <old> goes
 *   status / by / verified-by / against  removed from every element (`stripReviewMarks`)
 *
 * Runs right after includes, BEFORE bibliography and numbering — so a `<cite>` quoted
 * inside a dropped comment never numbers a paper, and nothing stripped ever consumed a
 * counter (the OPAQUE set in language/tags.ts already keeps a review build's numbers identical).
 * The block marks go later, at the start of render: the proof graph reads a proof's
 * `status` as its trust, and a final build's proof map must still show it.
 * A no-op unless `ctx.final`. Returns what it found; the pipeline sums the counts over the
 * project and warns once ("final build: 3 open comments, …") so the author knows the paper
 * is not done.
 */
export function finalizeReview(doc: ElementNode, ctx: CompileContext): FinalStats {
  const stats: FinalStats = { openComments: 0, openTasks: 0, unverified: 0, changesAccepted: 0 };
  if (!ctx.final) return stats;
  strip(doc, stats);
  return stats;
}

/** One-line summary of what a final build left behind, or "" when everything is done. */
export function describeFinal(s: FinalStats): string {
  const parts: string[] = [];
  if (s.openComments) parts.push(`${s.openComments} open comment${s.openComments === 1 ? "" : "s"}`);
  if (s.openTasks) parts.push(`${s.openTasks} open task${s.openTasks === 1 ? "" : "s"}`);
  if (s.unverified) parts.push(`${s.unverified} block${s.unverified === 1 ? "" : "s"} not verified`);
  return parts.length ? `final build: ${parts.join(", ")}` : "";
}

export function sumFinal(all: FinalStats[]): FinalStats {
  return all.reduce(
    (a, b) => ({
      openComments: a.openComments + b.openComments,
      openTasks: a.openTasks + b.openTasks,
      unverified: a.unverified + b.unverified,
      changesAccepted: a.changesAccepted + b.changesAccepted,
    }),
    { openComments: 0, openTasks: 0, unverified: 0, changesAccepted: 0 },
  );
}

function strip(el: ElementNode, stats: FinalStats): void {
  if (RAW_TAGS.has(el.tag)) return;
  const out: Node[] = [];
  for (const child of el.children) {
    if (child.type !== "element") {
      out.push(child);
      continue;
    }
    switch (child.tag) {
      case "comment":
        if (child.attrs.status !== "resolved") stats.openComments++;
        continue;
      case "todo":
        if (child.attrs.status !== "done") stats.openTasks++;
        continue;
      case "review":
      case "team":
        continue;
      case "draft": {
        stats.unverified++;
        strip(child, stats);
        out.push(...child.children);
        continue;
      }
      case "change": {
        stats.changesAccepted++;
        const holder: ElementNode = { ...child, children: acceptedContent(child) };
        strip(holder, stats);
        out.push(...holder.children);
        continue;
      }
    }
    const status = child.attrs.status;
    if (status !== undefined && !isChecked(status)) stats.unverified++;
    strip(child, stats);
    out.push(child);
  }
  el.children = out;
}

/** The marks a published paper does not show. */
const REVIEW_MARKS = ["status", "by", "verified-by", "against"];

/**
 * `--final` only: drops `status`, `by`, `verified-by` and `against` from every element.
 * After the proof graph, which reads a proof's status as its trust (and after `markStale`,
 * so a "stale" it wrote goes too).
 */
export function stripReviewMarks(doc: ElementNode, ctx: CompileContext): void {
  if (!ctx.final) return;
  for (const el of elements(doc)) for (const mark of REVIEW_MARKS) delete el.attrs[mark];
}
