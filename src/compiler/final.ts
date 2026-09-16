import type { ElementNode, Node } from "./ast";
import { warn, type CompileContext } from "./context";
import { RAW_TAGS } from "./preprocess";
import { changeParts } from "./collab";

/**
 * `--final` — the clean publication build. Strips every collaboration mark from the tree
 * so the same `.dlt` that carried the review also ships the paper:
 *
 *   <comment>, <todo>, <review>, <team>   removed (a comment's replies go with it)
 *   <draft>                              unwrapped (its prose stays)
 *   <change>                             accepted: <new> (or the bare insertion) stays, <old> goes
 *   status / by / verified-by            removed from every element
 *
 * Runs right after includes, BEFORE bibliography and numbering — so a `<cite>` quoted
 * inside a dropped comment never numbers a paper, and nothing stripped ever consumed a
 * counter (numbering.ts's OPAQUE set already keeps a review build's numbers identical).
 * A no-op unless `ctx.final`. Returns what it found; with `report` it warns once with the
 * counts ("final build: 3 open comments, …") so the author knows the paper is not done.
 */
export interface FinalStats {
  openComments: number;
  openTasks: number;
  /** Blocks whose status is not `verified` (drafts included). */
  unverified: number;
  changesAccepted: number;
}

export function finalizeReview(doc: ElementNode, ctx: CompileContext, report = true): FinalStats {
  const stats: FinalStats = { openComments: 0, openTasks: 0, unverified: 0, changesAccepted: 0 };
  if (!ctx.final) return stats;
  strip(doc, stats);
  if (report) {
    const msg = describeFinal(stats);
    if (msg) warn(ctx, msg);
  }
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
        const parts = changeParts(child);
        // replace / insert keep the <new> side (or the bare insertion); a delete keeps nothing.
        const keep: Node[] = parts.news.length
          ? parts.news.flatMap((n) => n.children)
          : parts.olds.length
            ? []
            : child.children;
        const holder: ElementNode = { ...child, children: keep };
        strip(holder, stats);
        out.push(...holder.children);
        continue;
      }
    }
    if (child.attrs.status !== undefined && child.attrs.status !== "verified") stats.unverified++;
    delete child.attrs.status;
    delete child.attrs.by;
    delete child.attrs["verified-by"];
    strip(child, stats);
    out.push(child);
  }
  el.children = out;
}
