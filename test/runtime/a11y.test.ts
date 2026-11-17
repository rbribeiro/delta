import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

/**
 * What a keyboard or screen-reader user gets: every trigger is reachable and named, every
 * bubble says what it is, and toggles say whether they are on. One page, one launch.
 */

const DOC = `<document lang="en">
  <title>A11y</title>
  <team><member id="ana" name="Ana"/></team>
  <review/>
  <section id="s"><title>S</title>
    <theorem id="thm">Statement.</theorem>
    See <ref to="thm"/>, and the literature <cite papers="A, B"/>.
    <hint>Try induction.</hint>
    <p>Text.<comment by="ana">A note.</comment></p>
  </section>
  <bibliography>
    <paper id="A"><author>Ann</author><title>One</title><year>2001</year></paper>
    <paper id="B"><author>Bo</author><title>Two</title><year>2002</year></paper>
  </bibliography>
</document>`;

const PROBE = `
  const enter = (el) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
  const bubbleOf = (trigger) => { trigger.click(); const b = openPopover(); const out = b && { role: b.getAttribute("role"), name: b.getAttribute("aria-label") }; key("Escape"); return out; };

  // A citation, from the keyboard alone.
  const cite = $("delta-cite .cite");
  cite.focus();
  const focused = document.activeElement === cite;
  enter(cite);
  const card = openPopover();
  const citation = {
    role: cite.getAttribute("role"),
    tabIndex: cite.tabIndex,
    name: cite.getAttribute("aria-label"),
    focused,
    opened: !!card && card.classList.contains("cite-pop"),
    expanded: cite.getAttribute("aria-expanded"),
    items: card ? $$(".cite-pop-item", card).length : 0,
  };
  key("Escape");
  citation.closed = openPopover() === null;

  // The bubbles.
  const bubbles = {
    ref: bubbleOf($("delta-ref .xref")),
    cite: bubbleOf(cite),
    hint: bubbleOf($(".hint-trigger")),
    comment: bubbleOf($(".note-marker")),
  };

  // The review panel's toggles.
  const pressed = (sel) => $$(sel).map((b) => b.getAttribute("aria-pressed"));
  const modes = { before: pressed(".review-seg button") };
  click('.review-seg [data-mode="final"]');
  modes.final = pressed(".review-seg button");
  click('.review-seg [data-mode="markup"]');
  const chip = $(".review-filter");
  const filter = [chip.getAttribute("aria-pressed")];
  chip.click();
  filter.push(chip.getAttribute("aria-pressed"));
  chip.click();
  filter.push(chip.getAttribute("aria-pressed"));

  return {
    citation,
    bubbles,
    modes,
    filter,
    hintEmojiHidden: $(".hint-marker").getAttribute("aria-hidden"),
  };`;

type Facts = {
  citation: Record<string, unknown>;
  bubbles: Record<string, { role: string; name: string } | null>;
  modes: { before: string[]; final: string[] };
  filter: string[];
  hintEmojiHidden: string | null;
};

describe.skipIf(!BROWSER)("accessibility", () => {
  const facts = lazy(() => inspect<Facts>(DOC, PROBE));

  it("a citation is a named button the keyboard reaches and opens", () => {
    expect(facts().citation).toEqual({
      role: "button",
      tabIndex: 0,
      name: "Citation 1, 2",
      focused: true,
      opened: true,
      expanded: "true",
      items: 2,
      closed: true,
    });
  });

  it("every bubble is a dialog named after its trigger", () => {
    expect(facts().bubbles).toEqual({
      ref: { role: "dialog", name: "Theorem 1.1" },
      cite: { role: "dialog", name: "Citation 1, 2" },
      hint: { role: "dialog", name: "Hint" },
      comment: { role: "dialog", name: "Comment 1" },
    });
  });

  it("the review panel's toggles say whether they are on", () => {
    expect(facts().modes.before).toEqual(["true", "false", "false"]);
    expect(facts().modes.final).toEqual(["false", "true", "false"]);
    expect(facts().filter).toEqual(["false", "true", "false"]);
  });

  it("the hint's emoji is decoration, hidden from screen readers", () => {
    expect(facts().hintEmojiHidden).toBe("true");
  });
});
