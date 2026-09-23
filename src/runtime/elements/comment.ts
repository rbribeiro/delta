/**
 * <comment> — a threaded review note, anchored where it sits in the prose or to another
 * element via `on="id"`. Non-intrusive: the page shows only a small superscript marker
 * with the comment's number (colored by its author; muted with a check once resolved);
 * clicking it opens the thread — author, date, status, body and <reply>s — in the shared
 * Delta.popover bubble.
 *
 *   …bounded on $K$.<comment by="claude" status="open" date="2026-09-12">
 *     Needs $K$ compact.<reply by="rodrigo" date="2026-09-13">Add the hypothesis.</reply>
 *   </comment>
 *   <comment on="thm-main" by="rodrigo">Is the constant sharp?</comment>
 *
 * The compiler numbers comments (one counter, no section prefix), writes `status`
 * ("open" by default) and validates `by` against <team>; this element only draws.
 * `html[data-review="off"]` — the <review> panel's switch — hides every marker, and
 * print never shows them (collab.css).
 */

import { t } from "../i18n";
import { popover } from "../utils";
import { memberChip, memberColor } from "./collab";

class DeltaComment extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const by = this.getAttribute("by");
    const status = this.getAttribute("status") ?? "open";
    const num = this.getAttribute("num");
    const color = memberColor(by);

    // Replies come out first; whatever is left is the comment's own text.
    const replies = [...this.querySelectorAll(":scope > delta-reply")];
    for (const r of replies) r.remove();
    const thread = buildThread(this, replies, { by, status, date: this.getAttribute("date") });
    if (color) thread.setAttribute("data-accent", color);

    // Snapshotted into a <ref> preview (a clone living inside the popover card): the
    // target's own thread shows statically; a comment nested inside a snapshotted
    // theorem hides (its marker would be inert). Never relocate from in here.
    if (this.closest(".delta-pop")) {
      if (this.parentElement?.classList.contains("xref-pop-body")) {
        thread.classList.add("note-static");
        this.replaceChildren(thread);
      } else {
        this.classList.add("note-hidden");
      }
      return;
    }

    const label = `${t("comment", "Comment")}${num ? ` ${num}` : ""}`;
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = "note-marker";
    marker.textContent = num ?? "•";
    marker.title = label;
    marker.setAttribute("aria-label", label);
    if (color) marker.setAttribute("data-accent", color);
    if (status === "resolved") marker.classList.add("is-resolved");
    // The marker may sit inside a collapsible label (a .box-tag / heading): keep its
    // click and keys from reaching the fold toggle.
    marker.addEventListener("click", (e) => e.stopPropagation());
    marker.addEventListener("keydown", (e) => e.stopPropagation());
    this.replaceChildren(marker);
    popover(marker, thread);

    // on="id": move the whole element next to its target (the host keeps the id, so
    // flashTarget / the review jump / data-review="off" all still find it). Into the
    // label when the target has one (box tag, heading, proof lead), else right after it.
    const on = this.getAttribute("on");
    if (on) {
      const target = document.getElementById(on);
      if (target && !target.contains(this)) {
        const slot = target.querySelector(
          ":scope > .box-tag, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > .proof-lead",
        );
        if (slot) slot.append(" ", this);
        else target.after(this);
      }
    }
  }
}

/** The thread bubble: head (author, date, status), body, replies. Moves `host`'s content. */
function buildThread(
  host: HTMLElement,
  replies: Element[],
  meta: { by: string | null; status: string; date: string | null },
): HTMLElement {
  const thread = document.createElement("div");
  thread.className = "note-pop";

  const head = document.createElement("div");
  head.className = "note-head";
  const chip = memberChip(meta.by);
  if (chip) head.append(chip);
  if (meta.date) {
    const date = document.createElement("span");
    date.className = "note-date";
    date.textContent = meta.date;
    head.append(date);
  }
  const pill = document.createElement("span");
  pill.className = "note-status";
  pill.dataset.status = meta.status;
  pill.textContent = t(meta.status, meta.status);
  head.append(pill);

  const body = document.createElement("div");
  body.className = "note-body";
  body.append(...host.childNodes); // move, so inline math/markup survive
  thread.append(head, body);

  if (replies.length) {
    const list = document.createElement("div");
    list.className = "note-replies";
    for (const r of replies) {
      const reply = document.createElement("div");
      reply.className = "note-reply";
      const rhead = document.createElement("div");
      rhead.className = "note-reply-head";
      const rchip = memberChip(r.getAttribute("by"));
      if (rchip) rhead.append(rchip);
      const rdate = r.getAttribute("date");
      if (rdate) {
        const d = document.createElement("span");
        d.className = "note-date";
        d.textContent = rdate;
        rhead.append(d);
      }
      const rbody = document.createElement("div");
      rbody.className = "note-reply-body";
      rbody.append(...r.childNodes);
      reply.append(rhead, rbody);
      list.append(reply);
    }
    thread.append(list);
  }
  return thread;
}

export function defineComment(): void {
  customElements.define("delta-comment", class extends DeltaComment {});
}
