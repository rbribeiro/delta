/**
 * <review> — the review & planning panel: everything a paper's collaborators left in it,
 * in one place. Reads the `#delta-review` island (team + the items `buildReview`
 * collected) and renders:
 *
 *   - a summary strip: open comments, open tasks, pending changes, blocks per status;
 *   - the two document-wide switches (window.Delta.review): annotations on/off and the
 *     change view (markup / final / original);
 *   - filter chips by member and by status;
 *   - the items grouped by kind — Comments, Tasks, Changes, Blocks — each with its number,
 *     status, people, text, and a jump to where it sits (cross-file in a project);
 *   - "Copy as text": the filtered list as plain text, to paste into a chat with an agent.
 *
 *   <review/>                    this file's items
 *   <review scope="project"/>    the whole project's (cross-file entries navigate)
 *   <floating><title>Review</title><review scope="project"/></floating>
 *
 * No persistence and no fetch: the `.dlt` is the state, this is a view of it.
 */

import { t } from "../i18n";
import { button, copyButton, linkJump, takeTitle } from "./shared";
import {
  memberChip,
  readReview,
  reviewState,
  REVIEW_EVENT,
  type ChangesMode,
  type ReviewItemData,
} from "./collab";

const KINDS = ["comment", "todo", "change", "status"] as const;
type Kind = (typeof KINDS)[number];
const GROUP_KEY: Record<Kind, string> = { comment: "annotations", todo: "tasks", change: "changes", status: "blocks" };
const GROUP_FALLBACK: Record<Kind, string> = { comment: "Comments", todo: "Tasks", change: "Changes", status: "Blocks" };
const PREFIX: Record<Kind, string> = { comment: "C", todo: "T", change: "Δ", status: "" };
const MODES: ChangesMode[] = ["markup", "final", "original"];

class DeltaReview extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const data = readReview();
    const projectScope = this.getAttribute("scope") === "project";
    const items = data.items.filter((i) => projectScope || !i.file);
    const heading = takeTitle(this);

    const root = document.createElement("section");
    root.className = "review";
    root.setAttribute("aria-label", heading?.text || t("reviewPanel", "Review"));

    // -- header: title + copy -------------------------------------------------
    const hd = document.createElement("div");
    hd.className = "review-hd";
    const title = document.createElement("span");
    title.className = "review-title";
    title.append(...(heading?.nodes ?? [t("reviewPanel", "Review")]));
    // "Copy as text": the items the filters leave visible, to paste into a chat with an agent.
    const copy = copyButton("review-copy", t("copyText", "Copy as text"), () => visible().map(asText).join("\n"));
    hd.append(title, copy);

    // -- summary ----------------------------------------------------------------
    const summary = document.createElement("div");
    summary.className = "review-summary";
    const stat = (n: number, label: string): void => {
      const s = document.createElement("span");
      s.className = "review-stat";
      const b = document.createElement("b");
      b.textContent = String(n);
      s.append(b, ` ${label}`);
      summary.append(s);
    };
    stat(items.filter((i) => i.kind === "comment" && i.status === "open").length, t("openComments", "open comments"));
    stat(items.filter((i) => i.kind === "todo" && i.status !== "done").length, t("openTasks", "open tasks"));
    stat(items.filter((i) => i.kind === "change").length, t("pendingChanges", "pending changes"));
    const perStatus = new Map<string, number>();
    for (const i of items) if (i.kind === "status") perStatus.set(i.status, (perStatus.get(i.status) ?? 0) + 1);
    for (const [status, n] of perStatus) stat(n, t(status, status));

    // -- switches -----------------------------------------------------------------
    const controls = document.createElement("div");
    controls.className = "review-controls";
    const annotations = button("review-switch", t("annotations", "Annotations"));
    annotations.addEventListener("click", () => reviewState.setAnnotations(!reviewState.annotations));
    const seg = document.createElement("div");
    seg.className = "review-seg";
    seg.setAttribute("role", "group");
    const segLabel = document.createElement("span");
    segLabel.className = "review-seg-label";
    segLabel.textContent = t("changes", "Changes");
    seg.append(segLabel);
    const modeButtons = MODES.map((mode) => {
      const b = button("", t(mode, mode));
      b.dataset.mode = mode;
      b.addEventListener("click", () => reviewState.setChanges(mode));
      seg.append(b);
      return b;
    });
    controls.append(annotations, seg);
    const syncControls = (): void => {
      annotations.setAttribute("aria-pressed", String(reviewState.annotations));
      for (const b of modeButtons) b.classList.toggle("is-active", b.dataset.mode === reviewState.changes);
    };
    syncControls();
    document.addEventListener(REVIEW_EVENT, syncControls);

    // -- filters -------------------------------------------------------------------
    const filters = document.createElement("div");
    filters.className = "review-filters";
    const activeMembers = new Set<string>();
    const activeStatuses = new Set<string>();
    const people = new Set<string>();
    const statuses = new Set<string>();
    for (const i of items) {
      for (const id of [i.by, i.for, i.verifiedBy]) if (id) people.add(id);
      statuses.add(i.status);
    }
    const chipButton = (cls: string, content: Node | string, set: Set<string>, key: string): void => {
      const b = button(`review-filter ${cls}`, content);
      b.dataset[cls === "review-filter-member" ? "member" : "status"] = key;
      b.addEventListener("click", () => {
        if (set.has(key)) set.delete(key);
        else set.add(key);
        b.classList.toggle("is-active", set.has(key));
        render();
      });
      filters.append(b);
    };
    for (const id of people) chipButton("review-filter-member", memberChip(id) ?? id, activeMembers, id);
    for (const s of statuses) chipButton("review-filter-status", t(s, s), activeStatuses, s);

    // -- list ------------------------------------------------------------------------
    const list = document.createElement("div");
    list.className = "review-list";
    const visible = (): ReviewItemData[] =>
      items.filter(
        (i) =>
          (activeMembers.size === 0 || [i.by, i.for, i.verifiedBy].some((id) => id && activeMembers.has(id))) &&
          (activeStatuses.size === 0 || activeStatuses.has(i.status)),
      );
    const render = (): void => {
      list.replaceChildren();
      const shown = visible();
      if (shown.length === 0) {
        const empty = document.createElement("p");
        empty.className = "review-empty";
        empty.textContent = t("nothingToReview", "Nothing to review");
        list.append(empty);
        return;
      }
      for (const kind of KINDS) {
        const group = shown.filter((i) => i.kind === kind);
        if (group.length === 0) continue;
        const gt = document.createElement("div");
        gt.className = "review-group-title";
        gt.textContent = t(GROUP_KEY[kind], GROUP_FALLBACK[kind]);
        list.append(gt);
        for (const i of group) list.append(row(i));
      }
    };
    render();

    root.append(hd, summary, controls);
    if (filters.childElementCount) root.append(filters);
    root.append(list);
    this.replaceChildren(root);
  }
}

/** One item row: number/label, status, people, text (+ replies), location. */
function row(i: ReviewItemData): HTMLElement {
  const el = document.createElement("div");
  el.className = "review-item";
  el.dataset.kind = i.kind;
  el.dataset.status = i.status;

  const hd = document.createElement("div");
  hd.className = "review-item-hd";
  const jump = document.createElement("a");
  jump.className = "review-jump";
  jump.href = i.file ? `${i.file}#${i.id}` : `#${i.id}`;
  const num = document.createElement("span");
  num.className = "review-num";
  num.textContent = i.kind === "status" ? `${t(i.tag, i.tag)}${i.num ? ` ${i.num}` : ""}` : `${PREFIX[i.kind]}${i.num ?? ""}`;
  jump.append(num);
  linkJump(jump, i.id, i.file);
  hd.append(jump);

  const pill = document.createElement("span");
  pill.className = "status-pill";
  pill.dataset.status = i.status;
  pill.textContent = t(i.status, i.status);
  hd.append(pill);
  if (i.kind === "change" && i.changeKind) {
    const k = document.createElement("span");
    k.className = "status-pill";
    k.textContent = t(i.changeKind, i.changeKind);
    hd.append(k);
  }
  if (i.kind === "todo" && i.priority && i.priority !== "normal") {
    const p = document.createElement("span");
    p.className = "status-pill review-prio";
    p.dataset.priority = i.priority;
    p.textContent = t(i.priority, i.priority);
    hd.append(p);
  }
  const byChip = memberChip(i.by);
  if (byChip) hd.append(byChip);
  const forChip = memberChip(i.for);
  if (forChip) {
    const w = document.createElement("span");
    w.className = "review-for";
    w.append(`${t("for", "for")} `, forChip);
    hd.append(w);
  }
  const vChip = memberChip(i.verifiedBy);
  if (vChip) {
    const w = document.createElement("span");
    w.className = "review-for";
    w.append("✓ ", vChip);
    hd.append(w);
  }
  if (i.date) {
    const d = document.createElement("span");
    d.className = "review-date";
    d.textContent = i.date;
    hd.append(d);
  }
  if (i.due) {
    const d = document.createElement("span");
    d.className = "review-date";
    d.textContent = `${t("due", "Due")} ${i.due}`;
    hd.append(d);
  }
  el.append(hd);

  if (i.kind === "status") {
    // A block's row carries its title (if any) and the note; the excerpt lives in `text`.
    if (i.html) {
      const ttl = document.createElement("div");
      ttl.className = "review-text review-block-title";
      ttl.innerHTML = i.html;
      el.append(ttl);
    }
  } else {
    const text = document.createElement("div");
    text.className = "review-text";
    text.innerHTML = i.html; // our own serialized content (keeps math and refs)
    el.append(text);
  }
  if (i.note) {
    const n = document.createElement("div");
    n.className = "review-note";
    n.textContent = i.note;
    el.append(n);
  }
  for (const r of i.replies ?? []) {
    const reply = document.createElement("div");
    reply.className = "review-reply";
    const chip = memberChip(r.by);
    if (chip) reply.append(chip, " ");
    const body = document.createElement("span");
    body.innerHTML = r.html;
    reply.append(body);
    el.append(reply);
  }
  if (i.heading) {
    const loc = document.createElement("a");
    loc.className = "review-loc";
    loc.href = i.file ? `${i.file}#${i.heading.id}` : `#${i.heading.id}`;
    loc.innerHTML = `§${i.heading.num ? ` ${i.heading.num}` : ""} ${i.heading.title}`;
    linkJump(loc, i.heading.id, i.file);
    el.append(loc);
  }
  return el;
}

/** A one-line plain rendering for "Copy as text" (the island's `text` fields). */
function asText(i: ReviewItemData): string {
  const head = i.kind === "status" ? "" : `${PREFIX[i.kind]}${i.num ?? ""} `;
  const who = [i.by && `${t("by", "by")} ${i.by}`, i.for && `${t("for", "for")} ${i.for}`].filter(Boolean).join(", ");
  const where = i.heading ? ` (§${i.heading.num || ""})` : "";
  const lines = [`${head}[${t(i.status, i.status)}]${who ? ` ${who}` : ""}: ${i.text}${where}`];
  if (i.note) lines.push(`    ${t("note", "Note")}: ${i.note}`);
  for (const r of i.replies ?? []) lines.push(`    ↳ ${r.by ?? "?"}: ${r.text}`);
  return lines.join("\n");
}

export function defineReview(): void {
  customElements.define("delta-review", DeltaReview);
}
