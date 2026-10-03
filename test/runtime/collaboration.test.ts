import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

const TEAM = `<team>
    <member id="ana" name="Ana Ribeiro" color="purple"/>
    <member id="bot" name="Claude" kind="agent"/>
  </team>`;

describe.skipIf(!BROWSER)("comments, tasks and changes", () => {
  const facts = lazy(() =>
    inspect(
      `<document>${TEAM}
        <p>Text.<comment by="ana">Is this right?<reply by="bot">Yes.</reply></comment></p>
        <todo for="bot" status="doing">Check the bound.</todo>
        <p>A <change by="ana"><old>bad</old><new>good</new></change> idea.</p>
        <lemma status="sketch" by="bot" verified-by="ana">L.</lemma>
      </document>`,
      `const marker = $(".note-marker");
       const markerText = marker.textContent;
       marker.click();
       const thread = openPopover();
       const pill = $(".box-tag .status-pill");
       const modes = [];
       window.Delta.review.setChanges("final");
       modes.push(document.documentElement.dataset.changes);
       window.Delta.review.setChanges("markup");
       modes.push(document.documentElement.dataset.changes ?? null);
       return {
         markerText,
         threadBody: text(".note-body", thread),
         replyBody: text(".note-reply-body", thread),
         threadAuthor: text(".who-name", thread),
         todoState: text(".todo-state"),
         todoNum: text(".todo-num"),
         todoBadge: text(".todo-for .who-badge"),
         changeKind: $("delta-change").dataset.kind,
         modes,
         pillStatus: pill.dataset.status,
         pillLabel: text(".status-label", pill),
         pillNames: $$(".who-name", pill).map((n) => n.textContent),
         lemmaStatus: $("delta-lemma").dataset.status,
       };`,
    ),
  );

  it("a comment is a numbered marker whose thread opens in a bubble", () => {
    expect(facts().markerText).toBe("1");
    expect(facts().threadBody).toBe("Is this right?");
    expect(facts().replyBody).toBe("Yes.");
    expect(facts().threadAuthor).toBe("Ana Ribeiro");
  });

  it("a task shows its state and who it is for", () => {
    expect(facts().todoState).toBe("◐");
    expect(facts().todoNum).toBe("Task 1");
    expect(facts().todoBadge).toBe("agent");
  });

  it("a change marks its kind; the document-wide switch picks which side shows", () => {
    expect(facts().changeKind).toBe("replace");
    expect(facts().modes).toEqual(["final", null]);
  });

  it("a block's status and authors become a pill in its label", () => {
    expect(facts().pillStatus).toBe("sketch");
    expect(facts().pillLabel).toBe("Sketch");
    expect(facts().pillNames).toEqual(["Claude", "Ana Ribeiro"]);
    expect(facts().lemmaStatus).toBe("sketch");
  });
});

describe.skipIf(!BROWSER)("<review>", () => {
  const DOC = `<document>${TEAM}<review/>
    <section id="s"><title>Intro</title>
      <comment by="ana">First note.</comment>
      <comment by="bot" status="resolved">Old note.</comment>
      <todo for="bot">Do it.</todo>
      <lemma id="l" status="sketch" by="bot">L.</lemma>
    </section></document>`;
  const facts = lazy(() =>
    inspect(
      DOC,
      `const stats = $$(".review-stat").map((s) => s.textContent);
       const groups = $$(".review-group-title").map((g) => g.textContent);
       const items = $$(".review-item").length;
       const loc = text(".review-loc");
       click('.review-filter-member[data-member="ana"]');
       const byAna = $$(".review-item").map((i) => i.dataset.kind);
       click('.review-filter-member[data-member="ana"]'); // off again
       click('.review-filter-status[data-status="resolved"]');
       const resolved = $$(".review-item .review-text").map((t) => t.textContent);
       click('.review-filter-status[data-status="resolved"]');
       const toggle = $(".review-switch");
       const pressed = [toggle.getAttribute("aria-pressed")];
       toggle.click();
       const off = document.documentElement.dataset.review ?? null;
       pressed.push(toggle.getAttribute("aria-pressed"));
       toggle.click();
       const back = document.documentElement.dataset.review ?? null;
       click('.review-item[data-kind="todo"] .review-jump');
       return { stats, groups, items, loc, byAna, resolved, pressed, off, back,
                jumped: $("delta-todo").classList.contains("is-xref-target") };`,
    ),
  );

  it("summarizes open work and lists the items grouped by kind", () => {
    expect(facts().stats).toEqual(["1 open comments", "1 open tasks", "0 pending changes", "1 Sketch"]);
    expect(facts().groups).toEqual(["Annotations", "Tasks", "Blocks"]);
    expect(facts().items).toBe(4);
    expect(facts().loc).toBe("§ 1 Intro");
  });

  it("filters by member and by status", () => {
    expect(facts().byAna).toEqual(["comment"]);
    expect(facts().resolved).toEqual(["Old note."]);
  });

  it("switches annotations off for the whole document, and back", () => {
    expect(facts().pressed).toEqual(["true", "false"]);
    expect(facts().off).toBe("off");
    expect(facts().back).toBeNull();
  });

  it("jumps to an item when its number is clicked", () => {
    expect(facts().jumped).toBe(true);
  });
});
