import { describe, expect, it } from "../harness.ts";
import { BROWSER, inspect, lazy } from "./helpers.ts";

const DOC = `<document>
  <section><title>One</title>
    <theorem id="t"><title>Main</title>Every $x$ works.</theorem>
    <lemma id="a">A.</lemma>
    Prose in between, so the proof stands alone.
    <proof of="a">Because.</proof>
    <theorem id="m">T.<meta><meta-item key="Source &lt;b&gt;">Euler</meta-item></meta></theorem>
    <theorem id="aid">T.<obstacle>Hard.</obstacle><intuition>Why.</intuition><strategy collapsed="false">How.</strategy></theorem>
    <lemma id="j">J.</lemma>
    <proof>First.</proof>
    <proof><title>Again</title>Second.</proof>
    <lemma id="n">N.<proof>Inside.</proof></lemma>
    <exercise id="ex">Do it.</exercise>
    <solution>Done.</solution>
    <lemma id="far">Far.</lemma>
    <lemma id="open" status="open">Planned.</lemma>
    <subsection><title>Two</title>x <proof of="far">Later.</proof></subsection>
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

       const aid = $("#aid");
       const folds = $$(".fold", aid);
       const state = () => folds.map((f) => f.classList.contains("is-open"));
       const startFolds = state();
       const panelHidden = $(".fold[data-aid=intuition] .fold-panel", aid).hidden;
       click("#aid .fold[data-aid=intuition] .fold-strip");
       const afterOpen = state();
       click("#aid .fold[data-aid=strategy] .fold-head");
       const afterClose = state();
       await sleep(450);

       const j = $("#j");
       const feet = $$(":scope > .proof-foot", j);
       const firstFolded = feet[0].classList.contains("is-collapsed");
       feet[0].querySelector(".proof-bar").click();
       const ex = $("#ex");
       const sol = $(":scope > .proof-foot", ex);
       const solBar = () => [...sol.querySelectorAll(".proof-bar-name > span")]
         .filter((s) => getComputedStyle(s).display !== "none").map((s) => s.textContent).join("");
       const solBefore = solBar();
       sol.querySelector(".proof-bar").click();
       return {
         isBox: main.classList.contains("box"),
         tag: text(".box-tag", main),
         tagTitle: text(".box-tag-title", main),
         head: text(".box-head", main),
         titleLeft: !!$("delta-title", main),
         lead: text("delta-proof:not(.proof-foot) > .proof-lead"),
         leadHasXref: !!$("delta-proof:not(.proof-foot) > .proof-lead .xref"),
         qed: !!$("delta-proof:not(.proof-foot) > .proof-qed"),
         metaLast: $(".box-body", meta).lastElementChild.className,
         metaKey: text(".box-meta .k", meta),
         metaKeyHasB: !!$(".box-meta .k b", meta),
         metaValue: text(".box-meta .v", meta),
         foldOrder: folds.map((f) => f.dataset.aid),
         foldNames: $$(".fold-strip", aid).map((s) => s.getAttribute("aria-label")),
         startFolds, panelHidden, afterOpen, afterClose,
         strategyHiddenLater: $(".fold[data-aid=strategy] .fold-panel", aid).hidden,
         noDots: !$(".lens-dots") && !$(".lens-drawer"),
         feet: feet.map((f) => f.querySelector(".proof-bar-name").textContent),
         firstFolded,
         firstOpened: !feet[0].classList.contains("is-collapsed"),
         nextToBox: $("#j + delta-proof") === null,
         nested: $$("#n > .proof-foot").length,
         nestedInBody: !!$("#n .box-body delta-proof"),
         solBefore,
         solAfter: solBar(),
         elsewhere: text("#far > .box-foot.proof-elsewhere"),
         elsewhereRef: $("#far > .box-foot delta-ref")?.getAttribute("to"),
         seeProof: text("#a > .box-foot"),
         pending: text("#open > .box-foot.proof-pending"),
         pendingStatus: text("#open .box-head .status-word"),
         h2: text("h2.section"),
         h3: text("h3.sub"),
         foldSequence: seq,
         startsClosed: $("#closed").classList.contains("is-collapsed"),
       };`,
    ),
  );

  it("draws a card with a header: the numbered label and the author's title", () => {
    expect(facts().isBox).toBe(true);
    expect(facts().tag).toBe("Theorem 1.1");
    expect(facts().tagTitle).toBe("Main");
    expect(facts().head).toBe("Theorem 1.1Main");
    expect(facts().titleLeft).toBe(false); // the title moved into the header
  });

  it("gives a proof standing alone an italic lead, a link to what it proves, and a QED mark", () => {
    expect(facts().lead).toBe("Proof Lemma 1.1.");
    expect(facts().leadHasXref).toBe(true);
    expect(facts().qed).toBe(true);
  });

  it("puts the <meta> row at the bottom of the statement, keys as text", () => {
    expect(facts().metaLast).toBe("box-meta");
    expect(facts().metaKey).toBe("Source <b>");
    expect(facts().metaKeyHasB).toBe(false);
    expect(facts().metaValue).toBe("Euler");
  });

  it("folds the reader aids under the statement, in a fixed order, closed unless opened", () => {
    expect(facts().noDots).toBe(true);
    expect(facts().foldOrder).toEqual(["intuition", "strategy", "obstacle"]);
    expect(facts().foldNames).toEqual(["Intuition", "Strategy", "Obstacle"]);
    expect(facts().startFolds).toEqual([false, true, false]); // strategy has collapsed="false"
    expect(facts().panelHidden).toBe(true);
  });

  it("unfolds an aid from its strip and folds it back from its header, each on its own", () => {
    expect(facts().afterOpen).toEqual([true, true, false]);
    expect(facts().afterClose).toEqual([true, false, false]);
    expect(facts().strategyHiddenLater).toBe(true); // once the paper has folded back
  });

  it("joins the proofs right after a result to its box as folded feet", () => {
    expect(facts().feet).toEqual(["Proof", "Proof (Again)"]);
    expect(facts().nextToBox).toBe(true); // moved inside the card
    expect(facts().firstFolded).toBe(true);
    expect(facts().firstOpened).toBe(true);
  });

  it("joins a proof nested in its result, outside the statement", () => {
    expect(facts().nested).toBe(1);
    expect(facts().nestedInBody).toBe(false);
  });

  it("joins a solution to its exercise, its bar saying what a click does", () => {
    expect(facts().solBefore).toBe("Show solution");
    expect(facts().solAfter).toBe("Hide solution");
  });

  it("says where a proof away from its result is, or that it is still to come", () => {
    expect(facts().elsewhere).toBe("Proof in Subsection 1.1");
    expect(facts().elsewhereRef).toBe("far-proof");
    expect(facts().seeProof).toBe("See the proof"); // further down the same section
    expect(facts().pending).toBe("Proof pending");
    expect(facts().pendingStatus).toBe("Open");
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
    const r = inspect(
      `<document lang="pt"><lemma id="l">L.<intuition>I.</intuition></lemma><proof>P.</proof><exercise>E.</exercise><solution>S.</solution></document>`,
      `return { tag: text(".box-tag"), fold: $(".fold-strip").getAttribute("aria-label"),
                bar: text("#l .proof-bar-name"), sol: text("delta-exercise .when-folded") };`,
    );
    expect(r).toEqual({ tag: "Lema 1", fold: "Intuição", bar: "Demonstração", sol: "Ver solução" });
  });

  it('opens every joined proof with <document proofs="open">', () => {
    const r = inspect(
      `<document proofs="open"><lemma id="l">L.</lemma><proof>P.</proof><lemma id="k">K.</lemma><proof collapsed="true">Q.</proof></document>`,
      `return $$(".proof-foot").map((p) => p.classList.contains("is-collapsed"));`,
    );
    expect(r).toEqual([false, true]); // the author's collapsed wins
  });
});

describe.skipIf(!BROWSER)("chapter headings", () => {
  it("set the chapter's numeral apart, with a small-caps kicker over the title", () => {
    const r = inspect(
      `<document type="book" lang="pt"><chapter><title>O grafo</title>x</chapter></document>`,
      `const h = $("h1.chapter-title");
       return { num: text(".num", h), kicker: text(".chapter-kicker", h), name: text(".chapter-name", h),
                grid: getComputedStyle(h).display };`,
    );
    expect(r).toEqual({ num: "1", kicker: "Capítulo 1", name: "O grafo", grid: "grid" });
  });
});

const STEPS = `<document>
  <theorem id="t">T.</theorem>
  <proof>Intro.
    <step id="s1"><claim>One.</claim><strategy>Plan.</strategy><proof>P1.</proof></step>
    <step id="s2"><claim>Two.</claim><proof>Then <step id="s21"><claim>Sub.</claim><intuition>I.</intuition><proof>Q.</proof></step></proof></step>
    <step id="s3"><claim>Three.</claim></step>
  </proof>
  <lemma id="far">F.</lemma>
  Prose in between.
  <proof of="far"><step id="x1"><claim>X.</claim><proof>Y.</proof></step></proof>
</document>`;

describe.skipIf(!BROWSER)("steps as pleats of the proof's sheet", () => {
  const facts = lazy(() =>
    inspect(
      STEPS,
      `const shows = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
       const foot = $("#t > .proof-foot");
       $(".proof-bar", foot).click(); // open the proof
       const s1 = $("#s1"), s2 = $("#s2"), s3 = $("#s3");
       const head = $(":scope > .step-head", s1);
       const start = [s1, s2].map((s) => s.classList.contains("is-collapsed"));
       const bodyHidden = !shows($(":scope > .step-body", s1));
       const aidStrip = $(":scope > .folds .fold[data-named] .fold-strip", s1);
       const aidLabel = $(".fold-label", aidStrip);
       const [only, full] = $$(".steps-control button", foot);
       await sleep(0);
       const pressedStart = [only.getAttribute("aria-pressed"), full.getAttribute("aria-pressed")];
       head.click();
       const opened = { folded: s1.classList.contains("is-collapsed"), expanded: head.getAttribute("aria-expanded"),
                        body: shows($(":scope > .step-body", s1)) };
       await sleep(0);
       const pressedMixed = [only.getAttribute("aria-pressed"), full.getAttribute("aria-pressed")];
       full.click();
       await sleep(0);
       const afterFull = { steps: [s1, s2].map((s) => s.classList.contains("is-collapsed")),
                           proofOpen: !foot.classList.contains("is-collapsed"),
                           pressed: [only.getAttribute("aria-pressed"), full.getAttribute("aria-pressed")] };
       const sub = $("#s21");
       const flat = { pleat: sub.classList.contains("step-pleat"), head: !!$(":scope > .step-head", sub),
                      body: shows($(":scope > .step-body", sub)), narrowFold: !!$(":scope > .folds .fold:not([data-named])", sub) };
       only.click();
       await sleep(450);
       const afterOnly = [s1, s2].map((s) => s.classList.contains("is-collapsed"));
       location.hash = "#s21";
       await sleep(50);
       const sheet = $("delta-proof.proof-sheet");
       const bg = (el) => getComputedStyle(el).backgroundColor;
       const paper = { foot: bg(foot), body: bg($(":scope > .collapse-body", foot)),
                       runs: $$(":scope > .collapse-body > .sheet-run", foot).map((r) => [r.textContent.trim(), bg(r) !== "rgba(0, 0, 0, 0)"]),
                       pleatCut: getComputedStyle($(":scope > .step-head", s1)).clipPath !== "none" };
       return {
         start, bodyHidden, afterOnly, opened, pressedStart, pressedMixed, afterFull, flat,
         headText: head.textContent,
         aidShowsFolded: shows(aidStrip), aidLabel: shows(aidLabel) ? aidLabel.textContent : null,
         noProofStep: { pleat: s3.classList.contains("step-pleat"), button: $(":scope > .step-head", s3).getAttribute("role") },
         leads: $$("#t delta-step .proof-lead").length,
         qeds: $$("#t .proof-qed").length,
         jumped: !s2.classList.contains("is-collapsed"),
         sheet: !!sheet && !sheet.classList.contains("is-collapsed"),
         sheetRef: sheet && sheet.querySelector(".proof-bar delta-ref")?.getAttribute("to"),
         sheetPleat: $("#x1").classList.contains("step-pleat"),
         paper,
       };`,
    ),
  );

  it("starts every top-level step folded, its number and claim printed on the fold", () => {
    expect(facts().start).toEqual([true, true]);
    expect(facts().bodyHidden).toBe(true);
    expect(facts().headText).toBe("1One.");
  });

  it("lays a step flat from its header", () => {
    expect(facts().opened).toEqual({ folded: false, expanded: "true", body: true });
  });

  it("keeps a step's aids reachable while it is folded, as named folds of the sheet", () => {
    expect(facts().aidShowsFolded).toBe(true);
    expect(facts().aidLabel).toBe("Strategy");
  });

  it('folds or opens every step with "Steps only · Full proof", without folding the proof', () => {
    expect(facts().pressedStart).toEqual(["true", "false"]);
    expect(facts().pressedMixed).toEqual(["false", "false"]);
    expect(facts().afterFull).toEqual({
      steps: [false, false],
      proofOpen: true,
      pressed: ["false", "true"],
    });
    expect(facts().afterOnly).toEqual([true, true]);
  });

  it("draws sub-steps flat inside their step, proof shown, aids narrow", () => {
    expect(facts().flat).toEqual({ pleat: false, head: false, body: true, narrowFold: true });
  });

  it("leaves a step without a proof flat, and gives steps no lead and no QED of their own", () => {
    expect(facts().noProofStep).toEqual({ pleat: true, button: null });
    expect(facts().leads).toBe(0);
    expect(facts().qeds).toBe(1);
  });

  it("paints the sheet in strips, so the pleats' cut corners show the page", () => {
    expect(facts().paper).toEqual({
      foot: "rgba(0, 0, 0, 0)",
      body: "rgba(0, 0, 0, 0)",
      runs: [
        ["Intro.", true],
        ["□", true],
      ],
      pleatCut: true,
    });
  });

  it("unfolds the step around a jump target", () => {
    expect(facts().jumped).toBe(true);
  });

  it("gives a proof with steps away from its box a sheet of its own, open, naming what it proves", () => {
    expect(facts().sheet).toBe(true);
    expect(facts().sheetRef).toBe("far");
    expect(facts().sheetPleat).toBe(true);
  });
});

describe.skipIf(!BROWSER)("the dashed edge of unfinished work", () => {
  it("runs down the folds' slanted sides too, and only on a dashed card", () => {
    const r = inspect(
      `<document><lemma id="d" status="sketch">D.<intuition>I.</intuition></lemma><lemma id="s">S.<intuition>I.</intuition></lemma></document>`,
      `const band = (id) => getComputedStyle($("#" + id + " .fold-valley"), "::before").backgroundImage;
       return { dashed: band("d"), solid: band("s") };`,
    );
    expect(r.dashed).not.toMatch(/^repeating-linear-gradient\(rgba\(0, 0, 0, 0\) 0px/);
    expect(r.solid).toMatch(/^repeating-linear-gradient\(rgba\(0, 0, 0, 0\) 0px/);
  });
});

describe.skipIf(!BROWSER)("the disclosure wedge", () => {
  const facts = lazy(() =>
    inspect(
      `<document><section id="a" collapsible="true"><title>A</title>
         <lemma id="l" collapsible="true">Statement.</lemma><proof>P.</proof>
       </section><section id="b" collapsed="true"><title>B</title>x</section></document>`,
      `const turn = (el, pseudo = "::before") => {
         const m = new DOMMatrix(getComputedStyle(el, pseudo).transform);
         return Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI);
       };
       const mark = (el) => getComputedStyle(el, "::before").content;
       const box = $("#l");
       const bar = $(":scope > .proof-foot", box);
       const before = { open: turn($("#a > h2")), folded: turn($("#b > h2")), boxOpen: turn($(".box-head", box)),
                        bar: turn($(".proof-bar-caret", bar)), signs: [mark($("#a > h2")), mark($("#b > h2"))] };
       const statementInSheet = !!$(".box-sheet .box-body", box);
       // this browser runs no animation frames: read the turn without the transition
       const still = document.createElement("style");
       still.textContent = "*::before { transition: none !important; }";
       document.head.append(still);
       $(".box-head", box).click();
       return { ...before, statementInSheet, boxFolded: turn($(".box-head", box)),
                statementHidden: $(".box-body", box).getClientRects().length === 0 };`,
    ),
  );

  it("points down at open content and right at folded content, with no ± sign", () => {
    expect(facts().open).toBe(45);
    expect(facts().folded).toBe(-45);
    expect(facts().bar).toBe(-45); // a joined proof starts folded
    expect(facts().signs).toEqual(['""', '""']); // drawn, not the old "−" / "+"
  });

  it("turns on a box header too, and folding a box keeps its statement in its sheet", () => {
    expect(facts().boxOpen).toBe(45);
    expect(facts().statementInSheet).toBe(true);
    expect(facts().boxFolded).toBe(-45);
    expect(facts().statementHidden).toBe(true);
  });
});

describe.skipIf(!BROWSER)("a folded section", () => {
  it("leaves a dashed line under its heading, naming what it hides; the line unfolds it", () => {
    const r = inspect(
      `<document lang="pt"><section id="s" collapsed="true"><title>S</title>
         <subsection><title>A</title><theorem>T.</theorem><lemma>L.</lemma></subsection>
         <subsection><title>B</title><definition>D.</definition></subsection>
       </section>After.
       <section id="e" collapsed="true"><title>E</title>Only text.</section>
       <section id="o" collapsible="true"><title>O</title>Open.</section></document>`,
      `const shows = (el) => !!el && el.getClientRects().length > 0;
       const strip = $("#s > .section-fold");
       const folded = { shows: shows(strip), label: strip.title, dashed: getComputedStyle(strip, "::before").borderTopStyle, afterHeading: strip.previousElementSibling.tagName,
                        empty: $("#e > .section-fold").title, openShows: shows($("#o > .section-fold")) };
       strip.click();
       return { ...folded, unfolded: !$("#s").classList.contains("is-collapsed"), goneWhenOpen: !shows(strip) };`,
    );
    expect(r).toEqual({
      shows: true,
      label: "2 subseções · 2 resultados · 1 definição",
      dashed: "dashed",
      afterHeading: "H2",
      empty: "Conteúdo recolhido",
      openShows: false,
      unfolded: true,
      goneWhenOpen: true,
    });
  });
});
