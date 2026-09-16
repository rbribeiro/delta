/**
 * Shared runtime substrate for the collaboration components (<comment>, <todo>,
 * <change>, status pills, <review>): the `#delta-review` island reader (the <team>
 * plus the items a panel lists), the author-chip builder every component uses for
 * `by`/`for`, and the two document-wide review switches exposed as `window.Delta.review`:
 *
 *   html[data-review="off"]                      hides every annotation (clean reading)
 *   html[data-changes="markup|final|original"]   how <change>s render (default markup)
 *
 * Nothing is persisted — the `.dlt` source is the collaboration state; the page only
 * offers views of it. Offline by construction: everything is read from inert in-page JSON.
 */

import { t } from "../i18n";

export interface ReviewMember {
  id: string;
  name: string;
  kind: "human" | "agent";
  /** A base.css accent palette name. */
  color: string;
}

export interface ReviewReplyData {
  by?: string;
  date?: string;
  text: string;
  html: string;
}

export interface ReviewHeadingData {
  level: number;
  num: string;
  id: string;
  title: string;
}

export interface ReviewItemData {
  kind: "comment" | "todo" | "change" | "status";
  id: string;
  tag: string;
  num?: string;
  status: string;
  by?: string;
  for?: string;
  verifiedBy?: string;
  date?: string;
  due?: string;
  priority?: string;
  changeKind?: string;
  note?: string;
  on?: string;
  text: string;
  html: string;
  replies?: ReviewReplyData[];
  heading?: ReviewHeadingData;
  /** Set on a project item that lives in another output file. */
  file?: string;
}

export interface ReviewData {
  team: ReviewMember[];
  items: ReviewItemData[];
}

// The #delta-review JSON island, parsed once (mirrors the i18n / toc caches).
let cache: ReviewData | null = null;
export function readReview(): ReviewData {
  if (cache) return cache;
  const el = document.getElementById("delta-review");
  try {
    const raw = el ? (JSON.parse(el.textContent || "{}") as Partial<ReviewData>) : {};
    cache = { team: raw.team ?? [], items: raw.items ?? [] };
  } catch {
    cache = { team: [], items: [] };
  }
  return cache;
}

export function member(id: string | null | undefined): ReviewMember | undefined {
  if (!id) return undefined;
  return readReview().team.find((m) => m.id === id);
}

/** Accent palette name for a member id; undefined for an unknown id (inherit the document accent). */
export function memberColor(id: string | null | undefined): string | undefined {
  return member(id)?.color;
}

/**
 * The author chip: a colored dot + the member's name (+ an "agent" badge for kind="agent").
 * An id that names nobody in the team renders as quiet free text. Returns null for no id.
 */
export function memberChip(id: string | null | undefined): HTMLElement | null {
  if (!id) return null;
  const chip = document.createElement("span");
  chip.className = "who";
  const m = member(id);
  if (!m) {
    chip.classList.add("who-free");
    chip.textContent = id;
    return chip;
  }
  chip.setAttribute("data-accent", m.color);
  chip.title = m.kind === "agent" ? `${m.name} · ${t("agent", "agent")}` : m.name;
  const dot = document.createElement("i");
  dot.className = "who-dot";
  dot.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "who-name";
  name.textContent = m.name;
  chip.append(dot, name);
  if (m.kind === "agent") {
    const badge = document.createElement("b");
    badge.className = "who-badge";
    badge.textContent = t("agent", "agent");
    chip.append(badge);
  }
  return chip;
}

export type ChangesMode = "markup" | "final" | "original";

/** Fired on `document` whenever a review switch flips, so panels can refresh their controls. */
export const REVIEW_EVENT = "delta:review";

export const reviewState = {
  /** Are annotations (comments, tasks, status pills, change markers) shown? */
  get annotations(): boolean {
    return document.documentElement.dataset.review !== "off";
  },
  setAnnotations(on: boolean): void {
    if (on) delete document.documentElement.dataset.review;
    else document.documentElement.dataset.review = "off";
    document.dispatchEvent(new CustomEvent(REVIEW_EVENT));
  },
  /** How `<change>`s render: markup (both sides), final (new only), original (old only). */
  get changes(): ChangesMode {
    const m = document.documentElement.dataset.changes;
    return m === "final" || m === "original" ? m : "markup";
  },
  setChanges(mode: ChangesMode): void {
    if (mode === "markup") delete document.documentElement.dataset.changes;
    else document.documentElement.dataset.changes = mode;
    document.dispatchEvent(new CustomEvent(REVIEW_EVENT));
  },
};
