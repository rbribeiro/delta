import { describe, expect, it } from "vitest";
import { mount } from "./helpers";

const DOC = `<document>
  <section id="s1"><title>First</title>
    <lemma id="a"><title>Key</title>The statement.</lemma>
    See <ref to="a"/> and <ref to="a">the key lemma</ref>, also $\\eqref{e}$.
    <equation id="e">x = 1</equation>
  </section>
  <section id="s2" collapsed="true"><title>Second</title>
    <subsection id="deep"><title>Deep</title>Text.</subsection>
  </section>
</document>`;

describe("<ref>", () => {
  it("reads as the target's label unless the author wrote their own text", async () => {
    const page = await mount(DOC);
    expect(page.$$("delta-ref .xref").map((b) => b.textContent)).toEqual([
      "Lemma 1.1",
      "the key lemma",
    ]);
  });

  it("opens a preview card cloned from the target's snapshot, without its ids", async () => {
    const page = await mount(DOC);
    const trigger = page.$("delta-ref .xref")!;
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const card = page.openPopover()!;
    expect(card.querySelector(".xref-pop-label")!.textContent).toBe("Lemma 1.1");
    expect(card.querySelector(".xref-pop-body")!.textContent).toContain("The statement.");
    expect(card.querySelector("[id]")).toBeNull(); // the original keeps the anchor
  });

  it("closes on Escape, and its go button jumps to the target", async () => {
    const page = await mount(DOC);
    page.click("delta-ref .xref");
    page.key("Escape");
    expect(page.$("delta-ref .xref")!.getAttribute("aria-expanded")).toBe("false");

    page.click("delta-ref .xref");
    page.click(".xref-go");
    expect(page.$("#a")!.classList.contains("is-xref-target")).toBe(true);
  });

  it("makes a \\ref inside math a keyboard-reachable trigger", async () => {
    const page = await mount(DOC);
    const marker = page.$(".math-xref")!;
    expect(marker.textContent).toBe("(1.1)");
    expect(marker.tabIndex).toBe(0);
    marker.click();
    expect(marker.getAttribute("aria-expanded")).toBe("true");
  });
});

describe("<toc>", () => {
  it("lists the headings, nested, with numbers and links", async () => {
    const page = await mount(DOC.replace("<document>", "<document><toc/>"));
    expect(page.$$(".toc-link").map((a) => [a.getAttribute("href"), a.textContent])).toEqual([
      ["#s1", "1 First"],
      ["#s2", "2 Second"],
      ["#deep", "2.1 Deep"],
    ]);
    expect(page.$(".toc-list > .toc-item > .toc-sub")).not.toBeNull();
    expect(page.$("nav.toc")!.getAttribute("aria-label")).toBe("Contents");
  });

  it("takes its heading from a <title>, and depth limits how deep it goes", async () => {
    const page = await mount(
      DOC.replace("<document>", `<document><toc depth="1"><title>Plan</title></toc>`),
    );
    expect(page.$(".toc-title")!.textContent).toBe("Plan");
    expect(page.$$(".toc-link")).toHaveLength(2);
  });

  it("unfolds a folded section to reach a heading inside it", async () => {
    const page = await mount(DOC.replace("<document>", "<document><toc/>"));
    expect(page.$("#s2")!.classList.contains("is-collapsed")).toBe(true);
    page.click('.toc-link[href="#deep"]');
    expect(page.$("#s2")!.classList.contains("is-collapsed")).toBe(false);
    expect(page.$("#deep")!.classList.contains("is-xref-target")).toBe(true);
  });
});

describe("<cite> and <bibliography>", () => {
  const BIB = `<document>
    As shown in <cite paper="k98"/> and <cite papers="k98,ab10"/>.
    <bibliography>
      <paper id="k98"><author>Knuth</author><title>Literate Programming</title><year>1998</year></paper>
      <paper id="ab10"><author>Abel</author><title>Series</title><year>2010</year></paper>
    </bibliography>
  </document>`;

  it("numbers citations in first-cite order and lists the papers", async () => {
    const page = await mount(BIB);
    expect(page.$$(".cite").map((c) => c.textContent)).toEqual(["[1]", "[1, 2]"]);
    expect(page.$$("section.notes li").map((li) => li.id)).toEqual(["k98", "ab10"]);
    expect(page.$("section.notes li")!.textContent).toBe("Knuth. Literate Programming. 1998.");
  });

  it("opens a card with every cited paper; its number jumps to the entry", async () => {
    const page = await mount(BIB);
    page.$$(".cite")[1].click();
    expect(
      page.$$(".cite-pop-item").map((i) => i.querySelector(".cite-pop-num")!.textContent),
    ).toEqual(["[1]", "[2]"]);
    page.$$(".cite-pop-num")[1].click();
    expect(page.$("#ab10")!.classList.contains("is-xref-target")).toBe(true);
  });
});

describe("<hint>", () => {
  it("is a trigger labelled by its title that reveals the body", async () => {
    const page = await mount(
      `<document><p>Try it <hint><title>Need a push?</title>Factor it.</hint>.</p></document>`,
    );
    const trigger = page.$(".hint-trigger")!;
    expect(trigger.textContent).toBe("💡 Need a push?");
    trigger.click();
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(page.openPopover()!.textContent).toBe("Factor it.");
  });
});
