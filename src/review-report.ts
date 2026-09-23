import type { ReviewItem, TeamMember } from "./compiler/context";

/**
 * The agent-facing view of a paper's collaboration state: `delta review` prints the
 * items `buildReview` collected, as text or JSON, with optional filters. Pure functions
 * (no I/O), so the CLI is a thin shell and tests need no process.
 */

export interface ReviewData {
  team: TeamMember[];
  items: ReviewItem[];
}

export interface ReviewFilter {
  status?: string;
  for?: string;
  by?: string;
  kind?: string;
}

export function filterReview(items: ReviewItem[], f: ReviewFilter): ReviewItem[] {
  return items.filter(
    (i) =>
      (!f.kind || i.kind === f.kind) &&
      (!f.status || i.status === f.status) &&
      (!f.by || i.by === f.by) &&
      (!f.for || i.for === f.for),
  );
}

/** The JSON shape: the island's fields minus the live AST nodes. */
export function reviewJson(data: ReviewData, items: ReviewItem[] = data.items): unknown {
  return {
    team: data.team,
    summary: summarize(items),
    items: items.map((i) => {
      const { body: _body, replies, heading, ...rest } = i;
      return {
        ...rest,
        ...(replies ? { replies: replies.map(({ body: _b, ...r }) => r) } : {}),
        ...(heading ? { heading: { level: heading.level, num: heading.num, id: heading.id } } : {}),
      };
    }),
  };
}

export interface ReviewSummary {
  openComments: number;
  openTasks: number;
  pendingChanges: number;
  blocks: Record<string, number>;
}

export function summarize(items: ReviewItem[]): ReviewSummary {
  const s: ReviewSummary = { openComments: 0, openTasks: 0, pendingChanges: 0, blocks: {} };
  for (const i of items) {
    if (i.kind === "comment" && i.status === "open") s.openComments++;
    else if (i.kind === "todo" && i.status !== "done") s.openTasks++;
    else if (i.kind === "change") s.pendingChanges++;
    else if (i.kind === "status") s.blocks[i.status] = (s.blocks[i.status] ?? 0) + 1;
  }
  return s;
}

const KIND_TITLE: Record<ReviewItem["kind"], string> = {
  comment: "Comments",
  todo: "Tasks",
  change: "Changes",
  status: "Blocks",
};
const KIND_PREFIX: Record<ReviewItem["kind"], string> = { comment: "C", todo: "T", change: "Δ", status: "" };

/** Human/agent-readable report: team, summary, then the items grouped by kind. */
export function formatReviewText(data: ReviewData, items: ReviewItem[] = data.items): string {
  const lines: string[] = [];
  if (data.team.length) {
    lines.push(`Team: ${data.team.map((m) => `${m.name} (${m.id}, ${m.kind})`).join(", ")}`);
  }
  const s = summarize(items);
  const blocks = Object.entries(s.blocks)
    .map(([k, n]) => `${n} ${k}`)
    .join(", ");
  lines.push(
    `Summary: ${s.openComments} open comment(s), ${s.openTasks} open task(s), ${s.pendingChanges} pending change(s)` +
      (blocks ? `; blocks: ${blocks}` : ""),
  );
  if (items.length === 0) {
    lines.push("", "Nothing to review.");
    return lines.join("\n") + "\n";
  }
  for (const kind of ["comment", "todo", "change", "status"] as const) {
    const group = items.filter((i) => i.kind === kind);
    if (group.length === 0) continue;
    lines.push("", KIND_TITLE[kind]);
    for (const i of group) lines.push(...formatItem(i));
  }
  return lines.join("\n") + "\n";
}

function formatItem(i: ReviewItem): string[] {
  const head =
    i.kind === "status" ? i.text.split(" — ")[0] : `${KIND_PREFIX[i.kind]}${i.num ?? "?"}`;
  const tags: string[] = [i.status];
  if (i.kind === "change" && i.changeKind) tags.push(i.changeKind);
  if (i.kind === "todo" && i.priority && i.priority !== "normal") tags.push(i.priority);
  const who: string[] = [];
  if (i.by) who.push(`by ${i.by}`);
  if (i.for) who.push(`for ${i.for}`);
  if (i.verifiedBy) who.push(`verified by ${i.verifiedBy}`);
  if (i.date) who.push(i.date);
  if (i.due) who.push(`due ${i.due}`);
  const where = [
    i.heading ? `§${i.heading.num || ""} ${headingText(i)}`.trim() : "",
    `${i.file ?? ""}#${i.id}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const out = [`  ${head} [${tags.join("/")}]${who.length ? ` ${who.join(" · ")}` : ""} · ${where}`];
  if (i.kind === "status") {
    const rest = i.text.split(" — ").slice(1).join(" — ");
    if (rest) out.push(`      ${rest}`);
  } else if (i.text) out.push(`      ${i.text}`);
  if (i.note) out.push(`      note: ${i.note}`);
  for (const r of i.replies ?? []) out.push(`      ↳ ${r.by ?? "?"}${r.date ? ` ${r.date}` : ""}: ${r.text}`);
  return out;
}

function headingText(i: ReviewItem): string {
  // The heading title is AST nodes; a text-only rendering is enough for the report.
  return (i.heading?.title ?? [])
    .map((n) => (n.type === "text" ? n.text : n.type === "element" ? flat(n) : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}
function flat(n: { children: import("./compiler/ast").Node[] }): string {
  return n.children.map((c) => (c.type === "text" ? c.text : c.type === "element" ? flat(c) : "")).join("");
}
