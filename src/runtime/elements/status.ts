/**
 * The status mark any block may carry — `status` (open | draft | heuristic | sketch | review
 * | verified | formalized, or the compiler's stale), `by` (who wrote it), `verified-by` (who
 * checked it) and `verified-on` (when; `delta verify` writes it):
 *
 * - While the block is being worked on, the mark is one quiet word in small caps ("Sketch")
 *   at the end of its header; the box's paper (status.css) tells the rest.
 * - Once checked (verified, formalized) the word becomes a rubber stamp in the checker's
 *   ink: "✓ Verified / R. Ribeiro · 13.IX.26". A stale verification keeps its stamp,
 *   faded and struck through: the check no longer holds.
 * - Resting the mouse on the word or the stamp (or clicking it) opens its history: who
 *   wrote, who checked — like a ref's preview.
 *
 * Environments, proofs, sections and `<draft>` call `applyStatus`. A no-op when none of
 * the attributes is present, so a document without them renders exactly as before.
 */

import { t } from "../i18n.ts";
import { popover } from "../utils.ts";
import { member, type ReviewMember } from "./collab.ts";
import { button } from "./shared.ts";

/** The states a stamp stands for; every other state is a word. */
const STAMPED = new Set(["verified", "formalized", "stale"]);

/**
 * Puts the status mark of `from` (the host itself, or the proof whose status a box shows
 * in its header) at the end of `slot` (a box header, a proof lead, a heading). With no slot
 * it prepends a `.status-bar` row instead. Sets `data-status` on the host, so the CSS can
 * draw its paper.
 */
export function applyStatus(host: HTMLElement, slot: Element | null, from: Element = host): void {
  const status = from.getAttribute("status");
  const by = from.getAttribute("by");
  const verifiedBy = from.getAttribute("verified-by");
  if (!status && !by && !verifiedBy) return;
  if (status) host.dataset.status = status;

  const mark = statusMark(from);
  if (slot) {
    slot.append(" ", mark);
  } else {
    const bar = document.createElement("div");
    bar.className = "status-bar";
    bar.append(mark);
    host.prepend(bar);
  }
}

/** The word or the stamp, wired to its history pop-over. */
function statusMark(from: Element): HTMLElement {
  const status = from.getAttribute("status");
  const by = member(from.getAttribute("by"));
  const checker = member(from.getAttribute("verified-by"));
  const checkerName = checker?.name ?? from.getAttribute("verified-by");
  const on = from.getAttribute("verified-on");

  const mark = document.createElement("span");
  mark.className = "status-mark";
  if (status) mark.dataset.status = status;

  let trigger: HTMLButtonElement;
  if (status && STAMPED.has(status)) {
    trigger = button("status-stamp");
    if (checker) trigger.dataset.accent = checker.color;
    const word = document.createElement("span");
    word.className = "stamp-word";
    word.textContent = `${status === "formalized" ? "∎" : "✓"} ${t(status === "stale" ? "verified" : status, status)}`;
    trigger.append(word);
    const sub = [checkerName ? shortName(checkerName) : "", on ? stampDate(on) : ""]
      .filter(Boolean)
      .join(" · ");
    if (sub) {
      const subEl = document.createElement("span");
      subEl.className = "stamp-sub";
      subEl.textContent = sub;
      trigger.append(subEl);
    }
    trigger.setAttribute("aria-label", t(status, status));
  } else {
    trigger = button("status-word");
    trigger.textContent = status ? t(status, status) : (by?.name ?? from.getAttribute("by") ?? "");
  }
  mark.append(trigger);
  wireHistory(trigger, () => history(from, status, by, checker, checkerName, on));
  return mark;
}

/** "Rodrigo Ribeiro" → "R. Ribeiro"; a one-word name stays as it is. */
function shortName(name: string): string {
  const words = name.trim().split(/\s+/);
  return words.length < 2 ? name : `${words[0][0]}. ${words.at(-1)}`;
}

const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** "2026-09-13" → "13.IX.26", the way a date stamp prints it. */
function stampDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${Number(m[3])}.${ROMAN[Number(m[2]) - 1] ?? m[2]}.${m[1].slice(2)}`;
}

/** "2026-09-13" → the page language's short date ("13 de set. de 2026"). */
function longDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  const lang = document.documentElement.lang || undefined;
  return d.toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });
}

/** The pop-over's content: the state, who wrote it, who checked it and when. */
function history(
  from: Element,
  status: string | null,
  by: ReviewMember | undefined,
  checker: ReviewMember | undefined,
  checkerName: string | null,
  on: string | null,
): HTMLElement {
  const box = document.createElement("div");
  box.className = "status-history";
  if (status) {
    const title = document.createElement("div");
    title.className = "status-history-title";
    title.textContent = t(status, status);
    box.append(title);
  }
  const author = by?.name ?? from.getAttribute("by");
  if (author) {
    const role = status === "open" ? t("proposedBy", "Proposed by") : t("writtenBy", "Written by");
    box.append(person(by, author, role));
  }
  if (checkerName) {
    const row = person(checker, checkerName, t("checkedBy", "Checked by"));
    if (on) row.querySelector(".status-history-text")!.append(`, ${longDate(on)}`);
    box.append(row);
  }
  if (status === "stale") {
    const note = document.createElement("div");
    note.className = "status-history-note";
    note.textContent = t("staleNote", "It changed after it was checked.");
    box.append(note);
  }
  return box;
}

/** One line of the history: an avatar (round for a person, square for an agent) and who did what. */
function person(m: ReviewMember | undefined, name: string, role: string): HTMLElement {
  const row = document.createElement("div");
  row.className = "status-history-row";
  const avatar = document.createElement("span");
  avatar.className = "status-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = name.trim()[0]?.toUpperCase() ?? "?";
  if (m) {
    avatar.dataset.accent = m.color;
    avatar.dataset.kind = m.kind;
  }
  const text = document.createElement("span");
  text.className = "status-history-text";
  const who = document.createElement("b");
  who.textContent = name;
  text.append(`${role} `, who);
  if (m?.kind === "agent") text.append(` (${t("agent", "agent")})`);
  row.append(avatar, text);
  return row;
}

/**
 * Opens the history the way Delta's previews open (refs, citations): resting the mouse on
 * the mark shows it, leaving closes it, a click pins it; touch taps; Escape or a click
 * elsewhere closes it. The bubble is built on first use: a page of statuses costs nothing
 * until a reader asks.
 */
function wireHistory(trigger: HTMLElement, build: () => HTMLElement): void {
  const content = document.createElement("div");
  let built = false;
  popover(trigger, content, {
    gap: 8,
    hover: true,
    onOpen: () => {
      if (built) return;
      built = true;
      content.append(build()); // inside the bubble: the bubble's own display stays the pop-over's
    },
  });
  // Enter/Space must reach the button, not a folding header around it (Escape must not:
  // the bubble closes on it).
  trigger.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") e.stopPropagation();
  });
}
