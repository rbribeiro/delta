import { describe, expect, it } from "vitest";
import { mount } from "./helpers";

const TEAM = `<team>
    <member id="ana" name="Ana Ribeiro" color="purple"/>
    <member id="bot" name="Claude" kind="agent"/>
  </team>`;

describe("comments, tasks and changes", () => {
  it("a comment is a numbered marker whose thread opens in a bubble", async () => {
    const page = await mount(
      `<document>${TEAM}<p>Text.<comment by="ana">Is this right?<reply by="bot">Yes.</reply></comment></p></document>`,
    );
    const marker = page.$(".note-marker")!;
    expect(marker.textContent).toBe("1");
    marker.click();
    const thread = page.openPopover()!;
    expect(thread.querySelector(".note-body")!.textContent).toBe("Is this right?");
    expect(thread.querySelector(".note-reply-body")!.textContent).toBe("Yes.");
    expect(thread.querySelector(".who-name")!.textContent).toBe("Ana Ribeiro");
  });

  it("a task shows its state and who it is for", async () => {
    const page = await mount(
      `<document>${TEAM}<todo for="bot" status="doing">Check the bound.</todo></document>`,
    );
    expect(page.$(".todo-state")!.textContent).toBe("◐");
    expect(page.$(".todo-num")!.textContent).toBe("Task 1");
    expect(page.$(".todo-for .who-badge")!.textContent).toBe("agent");
  });

  it("a change marks its kind; the document-wide switch picks which side shows", async () => {
    const page = await mount(
      `<document><p>A <change by="ana"><old>bad</old><new>good</new></change> idea.</p></document>`,
    );
    expect(page.$("delta-change")!.dataset.kind).toBe("replace");
    page.window.Delta.review.setChanges("final");
    expect(page.document.documentElement.dataset.changes).toBe("final");
    page.window.Delta.review.setChanges("markup");
    expect(page.document.documentElement.dataset.changes).toBeUndefined();
  });

  it("a block's status and authors become a pill in its label", async () => {
    const page = await mount(
      `<document>${TEAM}<lemma status="sketch" by="bot" verified-by="ana">L.</lemma></document>`,
    );
    const pill = page.$(".box-tag .status-pill")!;
    expect(pill.dataset.status).toBe("sketch");
    expect(pill.querySelector(".status-label")!.textContent).toBe("Sketch");
    expect([...pill.querySelectorAll(".who-name")].map((n) => n.textContent)).toEqual([
      "Claude",
      "Ana Ribeiro",
    ]);
    expect(page.$("delta-lemma")!.dataset.status).toBe("sketch");
  });
});

describe("<review>", () => {
  const DOC = `<document>${TEAM}<review/>
    <section id="s"><title>Intro</title>
      <comment by="ana">First note.</comment>
      <comment by="bot" status="resolved">Old note.</comment>
      <todo for="bot">Do it.</todo>
      <lemma id="l" status="sketch" by="bot">L.</lemma>
    </section></document>`;

  it("summarizes open work and lists the items grouped by kind", async () => {
    const page = await mount(DOC);
    expect(page.$$(".review-stat").map((s) => s.textContent)).toEqual([
      "1 open comments",
      "1 open tasks",
      "0 pending changes",
      "1 Sketch",
    ]);
    expect(page.$$(".review-group-title").map((g) => g.textContent)).toEqual([
      "Annotations",
      "Tasks",
      "Blocks",
    ]);
    expect(page.$$(".review-item")).toHaveLength(4);
    expect(page.$(".review-loc")!.textContent).toBe("§ 1 Intro");
  });

  it("filters by member and by status", async () => {
    const page = await mount(DOC);
    page.click('.review-filter-member[data-member="ana"]');
    expect(page.$$(".review-item").map((i) => i.dataset.kind)).toEqual(["comment"]);
    page.click('.review-filter-member[data-member="ana"]'); // off again
    page.click('.review-filter-status[data-status="resolved"]');
    expect(page.$$(".review-item .review-text").map((t) => t.textContent)).toEqual(["Old note."]);
  });

  it("switches annotations off for the whole document, and back", async () => {
    const page = await mount(DOC);
    const toggle = page.$(".review-switch")!;
    expect(toggle.getAttribute("aria-pressed")).toBe("true");
    toggle.click();
    expect(page.document.documentElement.dataset.review).toBe("off");
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    toggle.click();
    expect(page.document.documentElement.dataset.review).toBeUndefined();
  });

  it("jumps to an item when its number is clicked", async () => {
    const page = await mount(DOC);
    page.click('.review-item[data-kind="todo"] .review-jump');
    expect(page.$("delta-todo")!.classList.contains("is-xref-target")).toBe(true);
  });
});
