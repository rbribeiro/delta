/**
 * <todo> — a task in the plan: what, for whom, in which state, how urgent.
 *
 *   <todo for="claude" by="rodrigo" status="open" priority="high" due="2026-09-20">
 *     Expand the sketch in <ref to="prf-main"/> to a full proof.
 *   </todo>
 *
 * Renders as a checklist row: a state glyph (☐ open, ◐ doing, ☑ done), "Task 2", the
 * text, then a meta line (assignee chip, due date, priority). The compiler numbers tasks
 * (one counter, no prefix), writes the `status`/`priority` defaults and validates
 * `for`/`by` against <team>; this element only draws. `on="id"` moves the row right
 * after its target (after the heading, for a section). Hidden by the review switch
 * and in print (collab.css).
 */

import { t } from "../i18n";
import { memberChip, memberColor } from "./collab";

const GLYPH: Record<string, string> = { open: "☐", doing: "◐", done: "☑" }; // ☐ ◐ ☑

class DeltaTodo extends HTMLElement {
  connectedCallback(): void {
    if (this.dataset.deltaReady) return;
    this.dataset.deltaReady = "1";

    const status = this.getAttribute("status") ?? "open";
    const priority = this.getAttribute("priority") ?? "normal";
    const num = this.getAttribute("num");
    const assignee = this.getAttribute("for");
    const by = this.getAttribute("by");
    const due = this.getAttribute("due");

    this.classList.add("todo");
    this.dataset.status = status;
    this.dataset.priority = priority;
    const color = memberColor(assignee) ?? memberColor(by);
    if (color) this.setAttribute("data-accent", color);

    const state = document.createElement("span");
    state.className = "todo-state";
    state.setAttribute("aria-hidden", "true");
    state.textContent = GLYPH[status] ?? GLYPH.open;

    const text = document.createElement("div");
    text.className = "todo-text";
    if (num) {
      const label = document.createElement("span");
      label.className = "todo-num";
      label.textContent = `${t("todo", "Task")} ${num}`;
      text.append(label, " ");
    }
    text.append(...this.childNodes); // move, so refs/math survive
    this.setAttribute("aria-label", `${t("todo", "Task")}${num ? ` ${num}` : ""}: ${t(status, status)}`);

    const meta = document.createElement("div");
    meta.className = "todo-meta";
    const forChip = memberChip(assignee);
    if (forChip) {
      const who = document.createElement("span");
      who.className = "todo-for";
      who.append(`${t("for", "for")} `, forChip);
      meta.append(who);
    }
    const byChip = memberChip(by);
    if (byChip && by !== assignee) {
      const who = document.createElement("span");
      who.className = "todo-by";
      who.append(`${t("by", "by")} `, byChip);
      meta.append(who);
    }
    if (due) {
      const d = document.createElement("span");
      d.className = "todo-due";
      d.textContent = `${t("due", "Due")} ${due}`;
      meta.append(d);
    }
    if (priority !== "normal") {
      const p = document.createElement("span");
      p.className = "todo-prio";
      p.dataset.priority = priority;
      p.textContent = t(priority, priority);
      meta.append(p);
    }

    this.replaceChildren(state, text);
    if (meta.childElementCount) this.append(meta);

    // on="id": sit right after the target — after its heading when the target is a section.
    const on = this.getAttribute("on");
    if (on) {
      const target = document.getElementById(on);
      if (target && !target.contains(this)) {
        const heading = target.querySelector(":scope > h1, :scope > h2, :scope > h3, :scope > h4");
        (heading ?? target).after(this);
      }
    }
  }
}

export function defineTodo(): void {
  customElements.define("delta-todo", class extends DeltaTodo {});
}
