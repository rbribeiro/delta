import { describe, expect, it } from "vitest";
import { mount } from "./helpers";

describe("<theorem> and friends", () => {
  it("draws a box with a localized, numbered tag and the author's title", async () => {
    const page = await mount(`<document><section><title>S</title>
      <theorem id="t"><title>Main</title>Every $x$ works.</theorem>
    </section></document>`);
    const box = page.$("delta-theorem")!;
    expect(box.classList.contains("box")).toBe(true);
    expect(page.$(".box-tag")!.textContent).toBe("Theorem 1.1 Main");
    expect(page.$(".box-tag-title")!.textContent).toBe("Main");
    expect(page.$("delta-theorem > delta-title")).toBeNull(); // the title moved into the tag
  });

  it("speaks the document's language", async () => {
    const page = await mount(`<document lang="pt"><lemma>L.</lemma></document>`);
    expect(page.$(".box-tag")!.textContent).toBe("Lema 1");
  });

  it("gives a proof an italic lead, a link to what it proves, and a QED mark", async () => {
    const page = await mount(`<document><lemma id="a">A.</lemma><proof of="a">Because.</proof></document>`);
    const lead = page.$("delta-proof > .proof-lead")!;
    expect(lead.textContent).toBe("Proof Lemma 1.");
    expect(lead.querySelector(".xref")).not.toBeNull();
    expect(page.$("delta-proof > .proof-qed")).not.toBeNull();
  });

  it("puts the <meta> row at the bottom of the box, keys as text", async () => {
    const page = await mount(`<document><theorem>T.<meta><meta-item key="Source &lt;b&gt;">Euler</meta-item></meta></theorem></document>`);
    const box = page.$("delta-theorem")!;
    expect(box.lastElementChild!.className).toBe("box-meta");
    expect(page.$(".box-meta .k")!.textContent).toBe("Source <b>");
    expect(page.$(".box-meta .k b")).toBeNull();
    expect(page.$(".box-meta .v")!.textContent).toBe("Euler");
  });

  it("hangs a reader aid under the box as a dot and a folded drawer", async () => {
    const page = await mount(`<document><theorem>T.<intuition>Why.</intuition></theorem></document>`);
    expect(page.$$(".lens-dot").map((d) => d.dataset.aid)).toEqual(["intuition"]);
    expect(page.$("delta-theorem + .lens-drawer")).not.toBeNull();
  });
});

describe("sections and folding", () => {
  it("turns the title into a real heading with its number", async () => {
    const page = await mount(`<document><section><title>One</title><subsection><title>Two</title>x</subsection></section></document>`);
    expect(page.$("h2.section")!.textContent).toBe("1 One");
    expect(page.$("h3.sub")!.textContent).toBe("1.1 Two");
  });

  it("folds and unfolds a collapsible section, by click and by keyboard", async () => {
    const page = await mount(`<document><section collapsible="true"><title>One</title>Body.</section></document>`);
    const section = page.$("delta-section")!;
    const toggle = page.$(".collapse-toggle")!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    toggle.click();
    expect(section.classList.contains("is-collapsed")).toBe(true);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    page.key("Enter", ".collapse-toggle");
    expect(section.classList.contains("is-collapsed")).toBe(false);
  });

  it("starts folded with collapsed=\"true\"", async () => {
    const page = await mount(`<document><section collapsed="true"><title>One</title>Body.</section></document>`);
    expect(page.$("delta-section")!.classList.contains("is-collapsed")).toBe(true);
  });
});
