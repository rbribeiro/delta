import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

const DOC = `<document><toc/>
  <section id="s1"><title>First</title>
    <lemma id="a"><title>Key</title>The statement.</lemma>
    See <ref to="a"/> and <ref to="a">the key lemma</ref>, also $\\eqref{e}$.
    <equation id="e">x = 1</equation>
  </section>
  <section id="s2" collapsed="true"><title>Second</title>
    <subsection id="deep"><title>Deep</title>Text.</subsection>
  </section>
</document>`;

describe.skipIf(!BROWSER)("<ref> and <toc>", () => {
  const facts = lazy(() =>
    inspect(
      DOC,
      `const trigger = $("delta-ref .xref");
       const labels = $$("delta-ref .xref").map((b) => b.textContent);
       const expandedBefore = trigger.getAttribute("aria-expanded");
       trigger.click();
       const expandedAfter = trigger.getAttribute("aria-expanded");
       const card = openPopover();
       const cardLabel = text(".xref-pop-label", card);
       const cardBody = text(".xref-pop-body", card);
       const cardHasIds = !!$("[id]", card);
       key("Escape");
       const expandedAfterEscape = trigger.getAttribute("aria-expanded");
       trigger.click();
       click(".xref-go");
       const flashed = $("#a").classList.contains("is-xref-target");

       const marker = $(".math-xref");
       const mathLabel = marker.textContent;
       const mathTabIndex = marker.tabIndex;
       marker.click();
       const mathExpanded = marker.getAttribute("aria-expanded");
       key("Escape");

       const toc = $$(".toc-link").map((a) => [a.getAttribute("href"), a.textContent]);
       const nested = !!$(".toc-list > .toc-item > .toc-sub");
       const tocLabel = $("nav.toc").getAttribute("aria-label");
       const foldedBefore = $("#s2").classList.contains("is-collapsed");
       click('.toc-link[href="#deep"]');
       return {
         labels, expandedBefore, expandedAfter, cardLabel, cardBody, cardHasIds, expandedAfterEscape, flashed,
         mathLabel, mathTabIndex, mathExpanded, toc, nested, tocLabel, foldedBefore,
         foldedAfter: $("#s2").classList.contains("is-collapsed"),
         deepFlashed: $("#deep").classList.contains("is-xref-target"),
       };`,
    ),
  );

  it("reads as the target's label unless the author wrote their own text", () => {
    expect(facts().labels).toEqual(["Lemma 1.1", "the key lemma"]);
  });

  it("opens a preview card cloned from the target's snapshot, without its ids", () => {
    expect(facts().expandedBefore).toBe("false");
    expect(facts().expandedAfter).toBe("true");
    expect(facts().cardLabel).toBe("Lemma 1.1");
    expect(facts().cardBody).toContain("The statement.");
    expect(facts().cardHasIds).toBe(false); // the original keeps the anchor
  });

  it("closes on Escape, and its go button jumps to the target", () => {
    expect(facts().expandedAfterEscape).toBe("false");
    expect(facts().flashed).toBe(true);
  });

  it("makes a \\ref inside math a keyboard-reachable trigger", () => {
    expect(facts().mathLabel).toBe("(1.1)");
    expect(facts().mathTabIndex).toBe(0);
    expect(facts().mathExpanded).toBe("true");
  });

  it("lists the headings in the ToC, nested, with numbers and links", () => {
    expect(facts().toc).toEqual([
      ["#s1", "1 First"],
      ["#s2", "2 Second"],
      ["#deep", "2.1 Deep"],
    ]);
    expect(facts().nested).toBe(true);
    expect(facts().tocLabel).toBe("Contents");
  });

  it("unfolds a folded section to reach a heading inside it", () => {
    expect(facts().foldedBefore).toBe(true);
    expect(facts().foldedAfter).toBe(false);
    expect(facts().deepFlashed).toBe(true);
  });

  it("takes the ToC heading from a <title>, and depth limits how deep it goes", () => {
    const r = inspect(
      DOC.replace("<toc/>", `<toc depth="1"><title>Plan</title></toc>`),
      `return { title: text(".toc-title"), links: $$(".toc-link").length };`,
    );
    expect(r).toEqual({ title: "Plan", links: 2 });
  });
});

describe.skipIf(!BROWSER)("<cite> and <bibliography>", () => {
  const BIB = `<document>
    As shown in <cite paper="k98"/> and <cite papers="k98,ab10"/>.
    <bibliography>
      <paper id="k98"><author>Knuth</author><title>Literate Programming</title><year>1998</year></paper>
      <paper id="ab10"><author>Abel</author><title>Series</title><year>2010</year></paper>
    </bibliography>
  </document>`;
  const facts = lazy(() =>
    inspect(
      BIB,
      `const cites = $$(".cite").map((c) => c.textContent);
       const entries = $$("section.notes li").map((li) => li.id);
       const first = text("section.notes li");
       $$(".cite")[1].click();
       const items = $$(".cite-pop-item").map((i) => text(".cite-pop-num", i));
       $$(".cite-pop-num")[1].click();
       return { cites, entries, first, items, flashed: $("#ab10").classList.contains("is-xref-target") };`,
    ),
  );

  it("numbers citations in first-cite order and lists the papers", () => {
    expect(facts().cites).toEqual(["[1]", "[1, 2]"]);
    expect(facts().entries).toEqual(["k98", "ab10"]);
    expect(facts().first).toBe("Knuth. Literate Programming. 1998.");
  });

  it("opens a card with every cited paper; its number jumps to the entry", () => {
    expect(facts().items).toEqual(["[1]", "[2]"]);
    expect(facts().flashed).toBe(true);
  });
});

describe.skipIf(!BROWSER)("<hint>", () => {
  it("is a trigger labelled by its title that reveals the body", () => {
    const r = inspect(
      `<document><p>Try it <hint><title>Need a push?</title>Factor it.</hint>.</p></document>`,
      `const trigger = $(".hint-trigger");
       const label = trigger.textContent;
       trigger.click();
       return { label, expanded: trigger.getAttribute("aria-expanded"), body: openPopover().textContent };`,
    );
    expect(r).toEqual({ label: "💡 Need a push?", expanded: "true", body: "Factor it." });
  });
});
