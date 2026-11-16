import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

/**
 * The <animation> board in a real browser. Headless Chromium draws no frames between two
 * lines of a probe, so nothing here waits for an animation: a probe holds one at a chosen
 * time (`currentTime`) to look at it, or finishes it (`through`). Every check is on what is
 * painted (computed visibility, rectangles), not on the board's own idea of its state.
 */
const PRELUDE = `
  const board = $("delta-animation");
  // Plays a seek to its end: finishes whatever is running until the promise settles.
  const through = async (p) => {
    let done = false;
    p.then(() => (done = true));
    while (!done) { document.getAnimations().forEach((a) => a.finish()); await sleep(0); }
  };
  const shown = (el) => getComputedStyle(el).visibility === "visible";
  const box = (el) => { const r = el.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10).join(","); };
  // The rectangle of every character under el that paints, in document order.
  const glyphRects = (el) => {
    const out = [], range = document.createRange(), walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n; (n = walker.nextNode()); ) {
      if (n.parentElement.closest(".katex-mathml")) continue;
      for (let i = 0; i < n.data.length; i++) {
        if (!/[^\\s\\u200b]/.test(n.data[i])) continue;
        range.setStart(n, i); range.setEnd(n, i + 1);
        out.push(range.getBoundingClientRect());
      }
    }
    return out;
  };
`;

const PAPER = `<document lang="en"><section id="s"><title>S</title>
  <animation id="a"><caption>Cap</caption>
    Text first.
    <equation id="e">x^2 + 2x \\pause + 1</equation>
    <pause/>
    <morph target="e">(x + \\part{one}{1})^2</morph>
    <pause/>
    <list><item>one</item><pause/><item>two</item></list>
    <pause/>
    <hide target="e"/>
  </animation>
</section></document>`;

interface PaperFacts {
  length: number;
  restPos: number;
  label: string;
  count: string;
  restShown: boolean;
  restHidesEquation: boolean;
  noReflow: boolean;
  hiddenAt0: boolean;
  numberAt0: string;
  proxies: number;
  glyphs: number;
  worstOffset: number;
  dashStart: number;
  dashLater: number;
  inkAfter: number;
  runShownAfter: boolean;
  numberAt1: string;
  piecesOffAt1: number;
  interruptedPos: number;
  piecesOffAfterInterrupt: number;
  forms: number;
  oldFormShown: boolean;
  newFormShown: boolean;
  equationStable: boolean;
  baselineGap: number;
  morphLanding: number;
  listPauseKept: boolean;
  itemsAt4: string;
  itemsAt5: string;
  wrapPos: number;
  keyPos: number;
  prevPos: number;
  reducedProxies: number;
  reducedPos: number;
}

describe.skipIf(!BROWSER)("an <animation> in running text", () => {
  const facts = lazy(() =>
    inspect<PaperFacts>(
      PAPER,
      `${PRELUDE}
       const f = {};
       const equation = $("delta-equation", board), frame = $(".anim-frame"), run = $(".anim-run", board);
       const items = () => $$("li", board).map((li) => (shown(li) ? "1" : "0")).join("");
       const numberOf = () => getComputedStyle(equation, "::after").visibility;

       // At rest: the finished board, as a figure.
       f.length = board.length; f.restPos = board.pos;
       f.label = text(".figure-cap .lbl"); f.count = text(".anim-count");
       f.restShown = shown(run) && $$("li", board).every(shown);
       f.restHidesEquation = !shown(equation);
       const frameAtRest = box(frame), equationAtRest = box(equation);

       // Emptied: everything is hidden and nothing has moved.
       await board.seek(0);
       f.noReflow = box(frame) === frameAtRest;
       f.hiddenAt0 = !shown(run) && !$$("li", board).some(shown);
       f.numberAt0 = numberOf();

       // Step 1, held at its start: one proxy on each character of the text.
       const first = board.seek(1, true);
       const proxies = $$(".anim-ink text"), rects = glyphRects(run);
       f.proxies = proxies.length; f.glyphs = rects.length;
       // (The character's own cell, not the element's box: that one includes the pen's stroke.)
       const cell = (p) => { const e = p.getExtentOfChar(0), m = p.ownerSVGElement.getScreenCTM(); return { left: e.x * m.a + m.e, top: e.y * m.d + m.f }; };
       f.worstOffset = Math.max(...proxies.map((p, i) => {
         const c = cell(p);
         return Math.max(Math.abs(c.left - rects[i].left), Math.abs(c.top - rects[i].top));
       }));
       const trace = proxies[0].getAnimations()[0];
       trace.pause(); trace.currentTime = 0;
       f.dashStart = parseFloat(getComputedStyle(proxies[0]).strokeDashoffset);
       trace.currentTime = 200;
       f.dashLater = parseFloat(getComputedStyle(proxies[0]).strokeDashoffset);
       await through(first);
       f.inkAfter = $$(".anim-ink text").length; f.runShownAfter = shown(run);
       f.numberAt1 = numberOf();
       f.piecesOffAt1 = $$(".katex-html .anim-off", equation).length;

       // "Next" pressed while step 2 is still playing: step 2 lands, step 3 plays.
       board.seek(2, true);
       const third = board.seek(3, true);
       f.interruptedPos = board.pos;
       f.piecesOffAfterInterrupt = $$(".katex-html .anim-off", equation).length;

       // The morph, held at its end: a travelling glyph sits on its place in the new form.
       const forms = $$(".anim-forms > .katex", equation);
       document.getAnimations().forEach((a) => { a.pause(); a.currentTime = a.effect.getComputedTiming().endTime; });
       const xProxy = $$(".anim-ink text").find((p) => p.textContent === "x");
       const xTarget = glyphRects(forms[1]).find((r, i) => $(".katex-html", forms[1]).textContent.replace(/[\\s\\u200b]/g, "")[i] === "x");
       f.morphLanding = Math.abs(xProxy.getBoundingClientRect().left - xTarget.left);
       await through(third);
       f.forms = forms.length; f.oldFormShown = shown(forms[0]); f.newFormShown = shown(forms[1]);
       f.equationStable = box(equation) === equationAtRest;
       // Both forms stand on one baseline: their "x" share a bottom edge.
       const xBottom = (form) => glyphRects(form).find((r, i) => $(".katex-html", form).textContent.replace(/[\\s\\u200b]/g, "")[i] === "x").bottom;
       f.baselineGap = Math.abs(xBottom(forms[0]) - xBottom(forms[1]));

       // A <pause/> between two items of a list.
       f.listPauseKept = $("ol > delta-pause, ul > delta-pause", board) !== null;
       await board.seek(4); f.itemsAt4 = items();
       await board.seek(5); f.itemsAt5 = items();

       // The controls: "next" at the end starts over; the arrows step; "previous" undoes.
       await board.seek(board.length);
       click(".anim-next"); f.wrapPos = board.pos;
       document.getAnimations().forEach((a) => a.finish()); await sleep(0);
       key("ArrowRight", $(".anim-board")); f.keyPos = board.pos;
       click(".anim-prev"); f.prevPos = board.pos;

       // Reduced motion: the step is taken, nothing is drawn.
       window.matchMedia = (q) => ({ matches: /reduce/.test(q) });
       await board.seek(0);
       board.seek(1, true);
       f.reducedProxies = $$(".anim-ink text").length; f.reducedPos = board.pos;
       return f;`,
    ),
  );

  it("counts one step per pause, inside formulas and lists too", () => expect(facts().length).toBe(6));
  it("rests on its final state, as a figure", () => {
    expect(facts().restPos).toBe(6);
    expect(facts().restShown).toBe(true);
    expect(facts().restHidesEquation).toBe(true); // the last step hides it
    expect(facts().count).toBe("6/6");
  });
  it("is captioned with its number", () => expect(facts().label).toBe("Animation 1.1"));

  it("hides everything at step 0 without moving anything", () => {
    expect(facts().hiddenAt0).toBe(true);
    expect(facts().noReflow).toBe(true);
  });
  it("shows an equation's number with its first piece", () => {
    expect(facts().numberAt0).toBe("hidden");
    expect(facts().numberAt1).toBe("visible");
  });

  it("writes with one proxy per character, each on its glyph", () => {
    expect(facts().proxies).toBe(facts().glyphs);
    expect(facts().proxies).toBeGreaterThan(5);
    expect(facts().worstOffset).toBeLessThan(1);
  });
  it("traces the outline before filling it", () => {
    expect(facts().dashStart).toBeGreaterThan(0);
    expect(facts().dashLater).toBeLessThan(facts().dashStart);
  });
  it("hands back to the real glyphs when a step ends", () => {
    expect(facts().inkAfter).toBe(0);
    expect(facts().runShownAfter).toBe(true);
  });
  it("keeps the pieces after a \\pause for the next step", () => {
    expect(facts().piecesOffAt1).toBeGreaterThan(0);
  });

  it("lands an interrupted step on its end and plays the next", () => {
    expect(facts().interruptedPos).toBe(3);
    expect(facts().piecesOffAfterInterrupt).toBe(0);
  });

  it("stacks the forms of a morph in the equation, on one baseline", () => {
    expect(facts().forms).toBe(2);
    expect(facts().baselineGap).toBeLessThan(0.5);
    expect(facts().equationStable).toBe(true);
  });
  it("carries a matching glyph to its place in the new form", () => {
    expect(facts().morphLanding).toBeLessThan(1);
  });
  it("shows only the new form after a morph", () => {
    expect(facts().oldFormShown).toBe(false);
    expect(facts().newFormShown).toBe(true);
  });

  it("brings list items in one pause at a time", () => {
    expect(facts().listPauseKept).toBe(true);
    expect(facts().itemsAt4).toBe("10");
    expect(facts().itemsAt5).toBe("11");
  });

  it("starts over when 'next' is pressed at the end", () => expect(facts().wrapPos).toBe(1));
  it("steps with the arrow keys when the board is focused", () => expect(facts().keyPos).toBe(2));
  it("goes back one step with 'previous'", () => expect(facts().prevPos).toBe(1));

  it("takes steps without drawing under reduced motion", () => {
    expect(facts().reducedProxies).toBe(0);
    expect(facts().reducedPos).toBe(1);
  });
});

const NOTES = `<document lang="en"><section id="s"><title>S</title>
  <animation id="a">
    <equation id="e">\\part{a}{x^2} + \\part{b}{2x} + \\part{one}{1}</equation>
    <pause/>
    <note id="n" target="e" part="one" mark="circle">a unit</note>
    <pause/>
    <note id="u" target="e" part="b" mark="underline" side="top">twice</note>
    <pause/>
    <hide target="n"/>
    <pause/>
    <p id="p" a="1" label="x">a parameter</p>
    <pause/>
    <set target="p" a="-2" label="y"/>
  </animation>
</section></document>`;

interface NoteFacts {
  length: number;
  fontShipped: boolean;
  labelFace: string;
  inkToken: string;
  markStroke: string;
  labelColor: string;
  circleHoldsTarget: boolean;
  labelBelowCircle: boolean;
  labelAboveTarget: boolean;
  strokesAtStart: number[];
  labelProxies: number;
  labelChars: number;
  redrawnSame: boolean;
  hidden: { mark: boolean; label: boolean; other: boolean };
  before: string;
  after: string;
  undone: string;
  played: string;
}

describe.skipIf(!BROWSER)("notes and parameters on an <animation>", () => {
  const facts = lazy(() =>
    inspect<NoteFacts>(
      NOTES,
      `${PRELUDE}
       await document.fonts.ready;
       const f = {};
       const [circle, underline] = $$(".anim-mark"), [unit, twice] = $$(".anim-note"), p = $("#p");
       const one = $('[data-delta-part="one"]', board), b = $('[data-delta-part="b"]', board);
       const params = () => p.getAttribute("a") + "/" + p.getAttribute("label");
       f.length = board.length;

       // The pen: one ink for mark and words, in the handwriting face that shipped.
       const swatch = document.createElement("i");
       swatch.style.color = "var(--delta-note-ink)";
       document.body.append(swatch);
       f.inkToken = getComputedStyle(swatch).color;
       f.fontShipped = document.fonts.check('20px "Caveat"');
       f.labelFace = getComputedStyle(unit).fontFamily.split(",")[0].replace(/"/g, "");
       f.labelColor = getComputedStyle(unit).color;

       // Drawing a note: its strokes start undrawn and its words are written.
       await board.seek(1);
       const drawing = board.seek(2, true);
       f.markStroke = getComputedStyle($("path", circle)).stroke;
       f.strokesAtStart = $$("path", circle).map((path) => parseFloat(getComputedStyle(path).strokeDashoffset));
       f.labelProxies = $$(".anim-ink text").length;
       f.labelChars = unit.textContent.replace(/\\s/g, "").length;
       await through(drawing);

       // Where it lands: the circle around the piece it names, the words on their side.
       await board.seek(3);
       const ring = circle.getBoundingClientRect(), digit = glyphRects(one)[0];
       f.circleHoldsTarget = ring.left < digit.left && ring.right > digit.right
         && ring.top < (digit.top + digit.bottom) / 2 && ring.bottom > (digit.top + digit.bottom) / 2;
       f.labelBelowCircle = unit.getBoundingClientRect().top >= ring.bottom - 2;
       f.labelAboveTarget = twice.getBoundingClientRect().bottom <= Math.min(...glyphRects(b).map((r) => r.bottom));

       // The same note is the same drawing every time it is placed.
       const shape = () => $$("path", circle).map((path) => path.getAttribute("d")).join("|");
       const first = shape();
       await board.seek(0); await board.seek(3);
       f.redrawnSame = shape() === first && first.length > 20;

       // <hide> takes away the note it names, mark and words, and nothing else.
       await board.seek(4);
       f.hidden = { mark: !shown(circle), label: !shown(unit), other: !shown(underline) };

       // <set>: the values at each step, back and forth, and after playing it.
       await board.seek(5); f.before = params();
       await board.seek(6); f.after = params();
       await board.seek(5); f.undone = params();
       await through(board.seek(6, true)); f.played = params();
       return f;`,
    ),
  );

  it("counts a note, a hide and a set as steps", () => expect(facts().length).toBe(6));

  it("ships the handwriting face and writes the label in it", () => {
    expect(facts().fontShipped).toBe(true);
    expect(facts().labelFace).toBe("Caveat");
  });
  it("draws mark and words in the note ink", () => {
    expect(facts().markStroke).toBe(facts().inkToken);
    expect(facts().labelColor).toBe(facts().inkToken);
  });

  it("draws the mark stroke by stroke and writes the words", () => {
    expect(facts().strokesAtStart).toEqual([1]); // a whole path length away: nothing drawn yet
    expect(facts().labelProxies).toBe(facts().labelChars);
    expect(facts().labelChars).toBeGreaterThan(3);
  });

  it("circles the piece it names", () => expect(facts().circleHoldsTarget).toBe(true));
  it("puts the words on the asked side", () => {
    expect(facts().labelBelowCircle).toBe(true);
    expect(facts().labelAboveTarget).toBe(true);
  });
  it("draws the same mark each time it is placed", () => expect(facts().redrawnSame).toBe(true));

  it("hides a note with <hide>", () => {
    expect(facts().hidden).toEqual({ mark: true, label: true, other: false });
  });

  it("sets attributes at the step, and unsets them on the way back", () => {
    expect(facts().before).toBe("1/x");
    expect(facts().after).toBe("-2/y");
    expect(facts().undone).toBe("1/x");
  });
  it("lands on the set values after playing the step", () => expect(facts().played).toBe("-2/y"));
});

const DECK = `<document type="presentation">
  <slide><title>One</title><p>a</p></slide>
  <slide><title>Two</title>
    <animation><math>a \\pause + b</math><pause/><math>c</math></animation>
    <p reveal="true">after</p>
  </slide>
  <slide><title>Three</title><p>z</p></slide>
</document>`;

const slide = `($$("delta-slide").findIndex((s) => s.classList.contains("is-active")) + 1)`;

describe.skipIf(!BROWSER)("an <animation> on a slide", () => {
  const facts = lazy(() =>
    inspect(
      DECK,
      `${PRELUDE}
       const f = {}, after = $("delta-p[reveal]");
       const finish = async () => { document.getAnimations().forEach((a) => a.finish()); await sleep(0); await sleep(0); };
       f.bare = board.classList.contains("anim-bare"); f.controls = $(".anim-controls") !== null;
       f.length = board.length;

       key("ArrowRight");                       // onto slide 2: the board writes its first step
       f.entry = { slide: ${slide}, pos: board.pos, drawing: $$(".anim-ink text").length > 0 };
       await finish();
       key("ArrowRight"); await finish();       // the piece after \\pause
       f.second = { pos: board.pos, step: Delta.deck.step };
       key("ArrowRight"); await finish();
       f.third = { pos: board.pos, step: Delta.deck.step, after: after.classList.contains("is-revealed") };
       key("ArrowRight");                       // the board is done: the next fragment
       f.fourth = { slide: ${slide}, after: after.classList.contains("is-revealed") };
       key("ArrowRight");
       f.left = ${slide};
       key("ArrowLeft");                        // back into slide 2: all there, nothing playing
       f.back = { slide: ${slide}, pos: board.pos, drawing: $$(".anim-ink text").length, after: after.classList.contains("is-revealed") };
       key("ArrowLeft"); key("ArrowLeft");
       f.undone = { pos: board.pos, shown: $$(".katex", board).map((k) => (shown(k) ? "1" : "0")).join("") };
       return f;`,
    ),
  );

  it("has no frame or controls of its own", () => {
    expect(facts().bare).toBe(true);
    expect(facts().controls).toBe(false);
  });
  it("writes its first step when the slide is entered", () => {
    expect(facts().entry).toEqual({ slide: 2, pos: 1, drawing: true });
  });
  it("takes one advance per step, before the slide's later fragments", () => {
    expect(facts().second).toEqual({ pos: 2, step: 1 });
    expect(facts().third).toEqual({ pos: 3, step: 2, after: false });
    expect(facts().fourth).toEqual({ slide: 2, after: true });
    expect(facts().left).toBe(3);
  });
  it("is complete, and still, when the deck steps back into its slide", () => {
    expect(facts().back).toEqual({ slide: 2, pos: 3, drawing: 0, after: true });
  });
  it("undoes a step on the way back", () => {
    expect(facts().undone).toEqual({ pos: 2, shown: "10" });
  });

  it("is restored to its step after a reload", () => {
    const r = inspect<{ slide: number; pos: number }>(
      DECK,
      `if (!sessionStorage.getItem("reloaded")) {
         sessionStorage.setItem("reloaded", "1");
         history.replaceState({ step: 2 }, "", "#2");
         location.reload();
         await new Promise(() => {});
       }
       return { slide: ${slide}, pos: $("delta-animation").pos };`,
    );
    expect(r).toEqual({ slide: 2, pos: 3 });
  });
});
