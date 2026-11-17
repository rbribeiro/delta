import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

/**
 * The deck's keys and the controls on a slide. Space pages the deck, but Space on a focused
 * control belongs to the control: a button presses, a fold toggle folds, and the slide stays.
 * A synthetic key event cannot press a native button, so "the button keeps its Space" is
 * checked as the browser decides it: the keydown must not be cancelled (`defaultPrevented`).
 */

const DECK = `<document type="presentation" lang="en">
  <team><member id="ana" name="Ana"/></team>
  <slide><title>One</title>
    <code lang="python">print(1)</code>
    <theorem id="t" collapsible="true">Folds.</theorem>
    <lemma id="l" collapsible="true" status="sketch" by="ana">Its status word sits in its folding header.</lemma>
    <p>Text.<comment by="ana">A note.</comment></p>
  </slide>
  <slide><title>Two</title><p>b</p></slide>
</document>`;

type Press = { slide: number; prevented: boolean };

const PROBE = `
  const deck = window.Delta.deck;
  const press = (k, target) => {
    deck.go(0);
    if (target) target.focus();
    const ev = new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true });
    (target || document.body).dispatchEvent(ev);
    return { slide: deck.index, prevented: ev.defaultPrevented };
  };
  const toggle = $("#t .collapse-toggle");
  const foldedBefore = $("#t").classList.contains("is-collapsed");
  const onToggle = press(" ", toggle);
  const foldedAfter = $("#t").classList.contains("is-collapsed");
  const lemmaFolded = () => $("#l").classList.contains("is-collapsed");
  const lemmaBefore = lemmaFolded();
  const onInner = press(" ", $("#l .status-word"));
  const inner = { ...onInner, folded: lemmaFolded() !== lemmaBefore, inHeader: !!$("#l .collapse-toggle .status-word") };
  return {
    page: press(" ", null),
    copyButton: press(" ", $(".code-copy")),
    commentMarker: press(" ", $(".note-marker")),
    toggle: { ...onToggle, folded: foldedAfter !== foldedBefore },
    inner,
    arrowOnButton: press("ArrowRight", $(".code-copy")),
  };`;

describe.skipIf(!BROWSER)("keys in a deck", () => {
  const facts = lazy(() =>
    inspect<{
      page: Press;
      copyButton: Press;
      commentMarker: Press;
      toggle: Press & { folded: boolean };
      inner: Press & { folded: boolean; inHeader: boolean };
      arrowOnButton: Press;
    }>(DECK, PROBE),
  );

  it("Space on the page turns the slide", () => {
    expect(facts().page).toEqual({ slide: 1, prevented: true });
  });

  it("Space on a focused button presses the button, not the deck", () => {
    expect(facts().copyButton).toEqual({ slide: 0, prevented: false });
    expect(facts().commentMarker).toEqual({ slide: 0, prevented: false });
  });

  it("Space on a focused fold toggle folds, and the slide stays", () => {
    expect(facts().toggle).toMatchObject({ slide: 0, folded: true });
  });

  it("a button inside a fold toggle keeps its Space: the box does not fold", () => {
    expect(facts().inner).toEqual({ slide: 0, prevented: false, folded: false, inHeader: true });
  });

  it("the arrows still turn the slide from a focused button", () => {
    expect(facts().arrowOnButton).toEqual({ slide: 1, prevented: true });
  });
});
