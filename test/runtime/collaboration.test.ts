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
       const mark = $("delta-lemma .box-head .status-mark");
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
         markStatus: mark.dataset.status,
         markWord: text(".status-word", mark),
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

  it("a block in progress shows its status as one word at the end of its header", () => {
    expect(facts().markStatus).toBe("sketch");
    expect(facts().markWord).toBe("Sketch");
    expect(facts().lemmaStatus).toBe("sketch");
  });
});

describe.skipIf(!BROWSER)("status marks", () => {
  const facts = lazy(() =>
    inspect(
      `<document>${TEAM}
        <lemma id="v">V.</lemma>
        <proof status="verified" by="bot" verified-by="ana" verified-on="2026-09-13">P.</proof>
        <lemma id="f">F.</lemma>
        <proof status="formalized" verified-by="ana">P.</proof>
        <lemma id="o" status="open" by="ana">O.</lemma>
        <lemma id="d" status="draft">D.</lemma>
        <lemma id="k">K.</lemma>
        <proof status="sketch" by="bot">P.</proof>
        <proof status="verified" verified-by="ana">Q.</proof>
      </document>`,
      `const stamp = $("#v .box-head .status-stamp");
       stamp.click();
       const pop = openPopover();
       const rows = $$(".status-history-text", pop).map((r) => r.textContent);
       const avatars = $$(".status-avatar", pop).map((a) => a.dataset.kind);
       const head = $("#v .box-head");
       const headFolds = $("#v").classList.contains("is-collapsed");
       const paper = (id) => getComputedStyle($("#" + id + " > .box-sheet")).backgroundImage !== "none";
       const edge = () => getComputedStyle($("#d > .box-sheet"));
       const before = [paper("d"), edge().borderTopStyle];
       window.Delta.review.setAnnotations(false);
       const off = [paper("d"), edge().borderTopWidth,
                    getComputedStyle(stamp.parentElement).display];
       window.Delta.review.setAnnotations(true);
       return {
         stampWord: text(".stamp-word", stamp),
         stampSub: text(".stamp-sub", stamp),
         stampAccent: stamp.dataset.accent,
         lifted: $("#v").dataset.status,
         proofBarMark: !!$("#v .proof-bar .status-mark"),
         title: text(".status-history-title", pop),
         rows, avatars, headFolds,
         formal: text("#f .stamp-word"),
         formalSub: text("#f .stamp-sub"),
         open: text("#o .status-word"),
         second: [text("#k .box-head .status-word"), $$("#k .proof-bar .status-mark").map((m) => m.dataset.status)],
         before, off,
       };`,
    ),
  );

  it("stamps a checked result in its header, with the checker and the day", () => {
    expect(facts().stampWord).toBe("✓ Verified");
    expect(facts().stampSub).toBe("A. Ribeiro · 13.IX.26");
    expect(facts().stampAccent).toBe("purple");
    expect(facts().formal).toBe("∎ Formalized");
    expect(facts().formalSub).toBe("A. Ribeiro");
  });

  it("lifts the first joined proof's status into the box header; a second proof keeps its own", () => {
    expect(facts().lifted).toBe("verified");
    expect(facts().proofBarMark).toBe(false);
    expect(facts().second).toEqual(["Sketch", ["verified"]]);
  });

  it("opens the history from the mark, without folding the box", () => {
    expect(facts().title).toBe("Verified");
    expect(facts().rows).toEqual(["Written by Claude (agent)", "Checked by Ana Ribeiro, Sep 13, 2026"]);
    expect(facts().avatars).toEqual(["agent", "human"]);
    expect(facts().headFolds).toBe(false);
    expect(facts().open).toBe("Open");
  });

  it("draws unfinished work on squared paper with a dashed edge, plain under the review switch", () => {
    expect(facts().before).toEqual([true, "dashed"]);
    expect(facts().off).toEqual([false, "0px", "none"]);
  });

  it("opens the history on click and closes it by a second click, Escape or a click elsewhere", () => {
    const r = inspect(
      `<document>${TEAM}<lemma id="a" status="sketch" by="bot">A.</lemma></document>`,
      `const w = $(".status-word");
       const open = () => !!openPopover();
       const tick = () => sleep(20);
       w.dispatchEvent(new PointerEvent("pointerenter")); await tick(); const hover = open();
       w.click(); await tick(); const clicked = open();
       w.click(); await tick(); const second = open();
       w.click(); await tick();
       w.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })); await tick();
       const esc = open();
       w.click(); await tick();
       document.body.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); await tick();
       return { hover, clicked, second, esc, outside: open() };`,
    );
    expect(r).toEqual({ hover: false, clicked: true, second: false, esc: false, outside: false });
  });

  it("fades and strikes a stale stamp", () => {
    const r = inspect(
      `<document>${TEAM}<lemma id="a">A.</lemma><proof status="verified" verified-by="ana" against="000000000000">P.</proof></document>`,
      `const s = $("#a .status-stamp");
       return { status: $("#a .status-mark").dataset.status, word: text(".stamp-word", s),
                faded: Number(getComputedStyle(s).opacity) < 0.6,
                struck: getComputedStyle(s, "::after").content !== "none" };`,
    );
    expect(r).toEqual({ status: "stale", word: "✓ Verified", faded: true, struck: true });
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

describe.skipIf(!BROWSER)("previews (refs, status marks)", () => {
  const facts = lazy(() =>
    inspect(
      `<document>${TEAM}
        <lemma id="l" status="sketch" by="bot">L.</lemma>
        ${"<remark>Filler, so the page scrolls.</remark>".repeat(20)}
        <remark>By <ref to="l"/>.</remark>
        ${"<remark>More filler.</remark>".repeat(20)}
      </document>`,
      `const hovers = matchMedia("(hover: hover) and (pointer: fine)").matches;
       const opened = () => {
         const p = openPopover();
         return p ? (p.querySelector(".status-history") ? "status-history" : p.className.split(" ")[0]) : null;
       };
       // The test browser runs on virtual time, without rendering frames, so neither the
       // per-frame check nor the browser's own scroll events run: send the scroll event.
       const frame = async () => { window.dispatchEvent(new Event("scroll")); await sleep(20); };
       const out = { hovers };
       for (const [name, el] of [["mark", $(".status-word")], ["ref", $("delta-ref .xref")]]) {
         el.scrollIntoView({ block: "center" });
         if (hovers) {
           el.dispatchEvent(new PointerEvent("pointerenter", { pointerType: "mouse" }));
           await sleep(200); out[name + "Hover"] = opened();
           document.dispatchEvent(new PointerEvent("pointermove", { pointerType: "mouse", clientX: 1, clientY: 1 }));
           await sleep(250); out[name + "Away"] = opened();
         }
         el.click(); await frame(); out[name + "Click"] = opened();
         const gap = () => Math.round(openPopover().getBoundingClientRect().top - el.getBoundingClientRect().bottom);
         const before = gap();
         window.scrollBy(0, 60); await frame();
         out[name + "Follows"] = gap() === before;
         // Scroll the trigger off screen, whichever way is longer.
         const y = el.getBoundingClientRect().top + scrollY;
         window.scrollTo(0, y > innerHeight ? 0 : document.documentElement.scrollHeight); await frame();
         out[name + "Offscreen"] = opened();
       }
       return out;`,
    ),
  );

  it("follow their trigger while it scrolls, and close once it leaves the screen", () => {
    expect([facts().markClick, facts().markFollows, facts().markOffscreen]).toEqual(["status-history", true, null]);
    expect([facts().refClick, facts().refFollows, facts().refOffscreen]).toEqual(["xref-pop", true, null]);
  });

  it("open when a mouse rests on the trigger and close when it leaves (where there is a mouse)", () => {
    if (!facts().hovers) return; // headless Chromium reports no mouse; tapping is covered above
    expect([facts().markHover, facts().markAway]).toEqual(["status-history", null]);
    expect([facts().refHover, facts().refAway]).toEqual(["xref-pop", null]);
  });
});

describe.skipIf(!BROWSER)("a closed bubble", () => {
  it("is not painted, whatever its content's styles (status history, ref preview, citation)", () => {
    const r = inspect(
      `<document>${TEAM}<lemma id="l" status="sketch" by="bot">L.</lemma> See <ref to="l"/>.</document>`,
      `const shown = (p) => getComputedStyle(p).display !== "none";
       const out = {};
       for (const [name, sel] of [["status", ".status-word"], ["ref", "delta-ref .xref"]]) {
         const t = $(sel);
         t.click(); await sleep(20);
         const pop = openPopover();
         out[name] = [shown(pop)];
         document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })); await sleep(20);
         out[name].push(shown(pop));
       }
       return out;`,
    );
    expect(r).toEqual({ status: [true, false], ref: [true, false] });
  });
});
