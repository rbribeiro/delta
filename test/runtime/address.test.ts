import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

const DECK = `<document type="presentation">
  <slide><title>One</title><p>a</p></slide>
  <slide><title>Two</title><p reveal="true">b</p><p reveal="true">c</p></slide>
  <slide><title>Three</title><p>d</p></slide>
</document>`;

const active = `$$("delta-slide").findIndex((s) => s.classList.contains("is-active")) + 1`;

describe.skipIf(!BROWSER)("the address in a deck", () => {
  const facts = lazy(() =>
    inspect(
      DECK,
      `key("ArrowRight");
       const afterNext = location.hash;
       key("ArrowRight");
       const step = history.state && history.state.step;
       location.hash = "#3";
       await sleep(50);
       return { afterNext, step, typed: ${active}, hash: location.hash };`,
    ),
  );

  it("holds the slide number, 1-based", () => expect(facts().afterNext).toBe("#2"));
  it("keeps the revealed step in history.state", () => expect(facts().step).toBe(1));
  it("pages to a slide typed into the address", () => {
    expect(facts().typed).toBe(3);
    expect(facts().hash).toBe("#3");
  });

  it("lands back on the slide and step after a reload", () => {
    // First run: put the deck on slide 2, one fragment in, and reload; the second run reports.
    const r = inspect<{ slide: number; step: number; revealed: number }>(
      DECK,
      `if (!sessionStorage.getItem("reloaded")) {
         sessionStorage.setItem("reloaded", "1");
         history.replaceState({ step: 1 }, "", "#2");
         location.reload();
         await new Promise(() => {});
       }
       return { slide: ${active}, step: Delta.deck.step, revealed: $$(".is-revealed").length };`,
    );
    expect(r).toEqual({ slide: 2, step: 1, revealed: 1 });
  });
});

describe.skipIf(!BROWSER)("the address in a paper", () => {
  const facts = lazy(() =>
    inspect(
      `<document>
        <toc/>
        <section><title>Intro</title><p>a</p></section>
        <section id="later"><title>Later</title><p>b</p></section>
      </document>`,
      `click(".toc-link[href='#later']");
       return { hash: location.hash };`,
    ),
  );

  it("takes a ToC entry's anchor when it is clicked", () => expect(facts().hash).toBe("#later"));
});
