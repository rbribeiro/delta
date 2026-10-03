import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

const DOC = `<document>
  <section><title>One</title>
    <theorem id="t"><title>Main</title>Every $x$ works.</theorem>
    <lemma id="a">A.</lemma>
    <proof of="a">Because.</proof>
    <theorem id="m">T.<meta><meta-item key="Source &lt;b&gt;">Euler</meta-item></meta></theorem>
    <theorem id="aid">T.<intuition>Why.</intuition></theorem>
    <subsection><title>Two</title>x</subsection>
  </section>
  <section id="fold" collapsible="true"><title>Fold</title>Body.</section>
  <section id="closed" collapsed="true"><title>Closed</title>Body.</section>
</document>`;

describe.skipIf(!BROWSER)("<theorem> and friends", () => {
  const facts = lazy(() =>
    inspect(
      DOC,
      `const main = $("#t");
       const meta = $("#m");
       const toggle = $("#fold .collapse-toggle");
       const folded = () => $("#fold").classList.contains("is-collapsed");
       const seq = [toggle.getAttribute("aria-expanded"), folded()];
       toggle.click();
       seq.push(toggle.getAttribute("aria-expanded"), folded());
       key("Enter", toggle);
       seq.push(folded());
       return {
         isBox: main.classList.contains("box"),
         tag: text(".box-tag", main),
         tagTitle: text(".box-tag-title", main),
         titleLeft: !!$(":scope > delta-title", main),
         lead: text("delta-proof > .proof-lead"),
         leadHasXref: !!$("delta-proof > .proof-lead .xref"),
         qed: !!$("delta-proof > .proof-qed"),
         metaLast: meta.lastElementChild.className,
         metaKey: text(".box-meta .k", meta),
         metaKeyHasB: !!$(".box-meta .k b", meta),
         metaValue: text(".box-meta .v", meta),
         dots: $$("#aid .lens-dot").map((d) => d.dataset.aid),
         drawerAfter: !!$("#aid + .lens-drawer"),
         h2: text("h2.section"),
         h3: text("h3.sub"),
         foldSequence: seq,
         startsClosed: $("#closed").classList.contains("is-collapsed"),
       };`,
    ),
  );

  it("draws a box with a numbered tag and the author's title", () => {
    expect(facts().isBox).toBe(true);
    expect(facts().tag).toBe("Theorem 1.1 Main");
    expect(facts().tagTitle).toBe("Main");
    expect(facts().titleLeft).toBe(false); // the title moved into the tag
  });

  it("gives a proof an italic lead, a link to what it proves, and a QED mark", () => {
    expect(facts().lead).toBe("Proof Lemma 1.1.");
    expect(facts().leadHasXref).toBe(true);
    expect(facts().qed).toBe(true);
  });

  it("puts the <meta> row at the bottom of the box, keys as text", () => {
    expect(facts().metaLast).toBe("box-meta");
    expect(facts().metaKey).toBe("Source <b>");
    expect(facts().metaKeyHasB).toBe(false);
    expect(facts().metaValue).toBe("Euler");
  });

  it("hangs a reader aid under the box as a dot and a folded drawer", () => {
    expect(facts().dots).toEqual(["intuition"]);
    expect(facts().drawerAfter).toBe(true);
  });

  it("turns section titles into real headings with their numbers", () => {
    expect(facts().h2).toBe("1 One");
    expect(facts().h3).toBe("1.1 Two");
  });

  it("folds and unfolds a collapsible section, by click and by keyboard", () => {
    expect(facts().foldSequence).toEqual(["true", false, "false", true, false]);
  });

  it('starts folded with collapsed="true"', () => {
    expect(facts().startsClosed).toBe(true);
  });

  it("speaks the document's language", () => {
    const r = inspect(`<document lang="pt"><lemma>L.</lemma></document>`, `return { tag: text(".box-tag") };`);
    expect(r.tag).toBe("Lema 1");
  });
});
