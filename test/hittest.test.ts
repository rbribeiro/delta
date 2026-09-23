import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createContext } from "../src/compiler/context";
import { compileSource } from "../src/compiler/index";

/**
 * Hit-testing regression guard — the ONE thing a DOM shim cannot check.
 *
 * An in-math `\ref` marker was rendered, focusable and keyboard-operable, yet
 * unclickable: KaTeX builds an aligned environment out of `.vlist` table-cells
 * that are `position: relative; z-index: auto` and overlap freely, so a cell
 * later in the DOM painted over the marker and swallowed every pointer event.
 * Nothing about the markup or the listeners was wrong, so only a real layout +
 * paint engine can catch it — jsdom has neither and would report success.
 *
 * Hence a real browser, and hence `skipIf`: the suite must stay green on a
 * machine with no Chromium rather than pretend this was verified.
 */

function findBrowser(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const cmd of ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"]) {
    try {
      // `which` rather than a shell, so no argument concatenation is involved.
      const p = execFileSync("which", [cmd], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      if (p.trim()) return p.trim();
    } catch {
      /* not installed — try the next one */
    }
  }
  return undefined;
}

const BROWSER = findBrowser();

/** Renders `html` with `probe` appended, and returns whatever the probe puts in document.title. */
function evaluate(html: string, probe: string): string {
  const dir = mkdtempSync(join(tmpdir(), "delta-hittest-"));
  const file = join(dir, "page.html");
  writeFileSync(
    file,
    html.replace(
      "</body>",
      `<script>window.addEventListener("load",()=>{setTimeout(()=>{${probe}},350);});</script></body>`,
    ),
  );
  const dom = execFileSync(
    BROWSER!,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--virtual-time-budget=2500",
      "--window-size=1200,900",
      "--dump-dom",
      `file://${file}`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 },
  );
  return dom.match(/RESULT::([^<]*)/)?.[1] ?? "";
}

// `&` is written bare: <equations> is a RAW_TAG, so preprocess entity-escapes it.
const DOC = `<document lang="en">
  <title>T</title>
  <section id="s"><title>S</title>
    <equation id="eq:zero">\\mathbb{E}[(Y - \\mathbb{E}[Y|X])h(X)] = 0</equation>
    <equations id="eq:risk">
      \\text{Risk}(g) & = \\mathbb{E}\\left[ (Y - g(X))^2\\right] \\\\
        & = \\text{Risk}(f) + 2\\mathbb{E}\\left[ (Y - \\mathbb{E}[Y|X])(\\mathbb{E}[Y|X] - g(X))\\right] \\\\
        & \\stackrel{\\eqref{eq:zero}}{=} \\text{Risk}(f) + \\mathbb{E}\\left[ (\\mathbb{E}[Y|X] - g(X))^2\\right].
    </equations>
    Inline too: $A \\stackrel{\\ref{eq:zero}}{=} B$.
  </section>
</document>`;

function compile(): string {
  const ctx = createContext("test/doc.dlt");
  const html = compileSource(DOC, ctx);
  if (!html) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return html;
}

describe.skipIf(!BROWSER)("in-math \\ref markers are actually clickable", () => {
  it("owns the pixels across its own box, in display and inline math", () => {
    // Sampled across the width: a marker can be half-covered, which still reads
    // as "sometimes it works" to a user.
    const out = evaluate(
      compile(),
      `const r=[...document.querySelectorAll(".katex [data-delta-ref-to]")].map(m=>{
         const b=m.getBoundingClientRect();
         const owns=[0.15,0.5,0.85].every(f=>{
           const el=document.elementFromPoint(b.left+b.width*f, b.top+b.height/2);
           return !!el && m.contains(el);
         });
         return (m.closest(".katex-display")?"display":"inline")+"="+owns;
       });
       document.title="RESULT::"+r.join(",");`,
    );
    expect(out).toBe("display=true,inline=true");
  });

  it("opens the popover by clicking whatever the browser reports at that point", () => {
    // The event is synthesized, but it is dispatched on the element the browser
    // itself hit-tests to — which is exactly what regressed. (The pixel-ownership
    // test above is the stricter half; this one proves the wiring end to end.)
    const out = evaluate(
      compile(),
      `const open=()=>[...document.querySelectorAll(".delta-pop")]
           .filter(p=>getComputedStyle(p).display!=="none").length;
       const m=document.querySelector(".katex-display [data-delta-ref-to]");
       const b=m.getBoundingClientRect();
       const t=document.elementFromPoint(b.left+b.width/2, b.top+b.height/2);
       for(const ty of ["pointerdown","mousedown","mouseup","click"])
         t.dispatchEvent(new MouseEvent(ty,{bubbles:true,cancelable:true,view:window}));
       document.title="RESULT::mouse="+(open()>0)
         +",jump="+!!document.querySelector(".delta-pop button");`,
    );
    expect(out).toBe("mouse=true,jump=true");
  });

  it("still opens from the keyboard (the path that never broke)", () => {
    const out = evaluate(
      compile(),
      `const open=()=>[...document.querySelectorAll(".delta-pop")]
           .filter(p=>getComputedStyle(p).display!=="none").length;
       const m=document.querySelector(".katex-display [data-delta-ref-to]");
       m.focus();
       const focused=document.activeElement===m;
       m.dispatchEvent(new KeyboardEvent("keydown",{key:" ",bubbles:true,cancelable:true}));
       document.title="RESULT::focusable="+focused+",space="+(open()>0);`,
    );
    expect(out).toBe("focusable=true,space=true");
  });
});

// ---------------------------------------------------------------------------
// Collaboration components: the marker/popover/relocation wiring and the
// document-wide review switch are DOM behaviour, so they are checked here too.

const COLLAB_DOC = `<document lang="en">
  <title>T</title>
  <team>
    <member id="rb" name="Rodrigo" color="blue"/>
    <member id="ai" name="Claude" kind="agent" color="purple"/>
  </team>
  <section id="s"><title>S</title>
    Some prose.<comment id="c-inline" by="ai" date="2026-09-12">Inline note with $x$.
      <reply by="rb">Reply.</reply></comment>
    <theorem id="thm" status="review" by="ai"><title>Main</title>body</theorem>
    <comment id="c-on" on="thm" by="rb" status="resolved">Anchored note.</comment>
    <proof of="thm" status="sketch" by="ai">sketchy</proof>
    <todo id="t1" for="ai" priority="high">Finish the proof.</todo>
    <draft by="ai" note="loose">Loose prose.</draft>
    Then <change id="ch1" by="ai" date="2026-09-12" note="sign"><old>$x < 0$</old><new>$x > 0$</new></change> holds.
    <change id="ch2" by="rb"><lemma id="new-lemma">Inserted lemma.</lemma></change>
  </section>
</document>`;

function compileSrc(src: string): string {
  const ctx = createContext("test/doc.dlt");
  const html = compileSource(src, ctx);
  if (!html) throw new Error("compile failed: " + JSON.stringify(ctx.diagnostics));
  return html;
}

describe.skipIf(!BROWSER)("collaboration runtime", () => {
  it("opens a comment thread from its marker, with the author chip in the member's color", () => {
    const out = evaluate(
      compileSrc(COLLAB_DOC),
      `const m=document.querySelector('#c-inline .note-marker');
       m.click();
       const pop=[...document.querySelectorAll(".note-pop")].find(p=>getComputedStyle(p).display!=="none");
       const chip=pop&&pop.querySelector(".who");
       const badge=pop&&pop.querySelector(".who-badge");
       const replies=pop?pop.querySelectorAll(".note-reply").length:0;
       document.title="RESULT::open="+!!pop+",accent="+(chip&&chip.dataset.accent)+",badge="+!!badge
         +",replies="+replies+",math="+!!(pop&&pop.querySelector(".katex"));`,
    );
    expect(out).toBe("open=true,accent=purple,badge=true,replies=1,math=true");
  });

  it(`moves an on="id" comment into its target's label and marks resolved ones`, () => {
    const out = evaluate(
      compileSrc(COLLAB_DOC),
      `const c=document.getElementById("c-on");
       const inTag=c.parentElement.classList.contains("box-tag");
       const resolved=c.querySelector(".note-marker").classList.contains("is-resolved");
       const pill=document.querySelector("#thm .box-tag .status-pill");
       const proofPill=document.querySelector('delta-proof[status="sketch"] .proof-lead .status-pill');
       document.title="RESULT::inTag="+inTag+",resolved="+resolved
         +",thmPill="+(pill&&pill.dataset.status)+",proofPill="+(proofPill&&proofPill.dataset.status);`,
    );
    expect(out).toBe("inTag=true,resolved=true,thmPill=review,proofPill=sketch");
  });

  it("hides every annotation under the review switch and restores it", () => {
    const out = evaluate(
      compileSrc(COLLAB_DOC),
      `const vis=el=>getComputedStyle(el).display!=="none";
       const c=document.getElementById("c-inline"), t=document.getElementById("t1");
       const pill=document.querySelector("#thm .status-pill"), bar=document.querySelector("delta-draft .status-bar");
       const before=[c,t,pill,bar].every(vis);
       window.Delta.review.setAnnotations(false);
       const off=document.documentElement.dataset.review==="off" && ![c,t,pill,bar].some(vis);
       window.Delta.review.setAnnotations(true);
       const back=document.documentElement.dataset.review===undefined && [c,t,pill,bar].every(vis);
       document.title="RESULT::before="+before+",off="+off+",back="+back;`,
    );
    expect(out).toBe("before=true,off=true,back=true");
  });

  it("renders a task row with its state, number and assignee", () => {
    const out = evaluate(
      compileSrc(COLLAB_DOC),
      `const t=document.getElementById("t1");
       document.title="RESULT::state="+t.querySelector(".todo-state").textContent
         +",num="+t.querySelector(".todo-num").textContent
         +",for="+(t.querySelector(".todo-for .who")||{}).dataset?.accent
         +",prio="+t.dataset.priority;`,
    );
    expect(out).toBe("RESULT::state=☐,num=Task 1,for=purple,prio=high".slice(8));
  });
});

describe.skipIf(!BROWSER)("tracked changes runtime", () => {
  it("renders both sides in markup view and switches to final / original", () => {
    const out = evaluate(
      compileSrc(COLLAB_DOC),
      `const vis=el=>getComputedStyle(el).display!=="none";
       const ch=document.getElementById("ch1");
       const del=ch.querySelector(".chg-del"), ins=ch.querySelector(".chg-ins"), mk=ch.querySelector(".chg-marker");
       const markup=vis(del)&&vis(ins)&&vis(mk)&&getComputedStyle(ins).textDecorationLine.includes("underline")
         &&getComputedStyle(del).textDecorationLine.includes("line-through");
       window.Delta.review.setChanges("final");
       const fin=!vis(del)&&vis(ins)&&!vis(mk)&&getComputedStyle(ins).textDecorationLine==="none";
       window.Delta.review.setChanges("original");
       const orig=vis(del)&&!vis(ins)&&getComputedStyle(del).textDecorationLine==="none";
       window.Delta.review.setChanges("markup");
       const back=document.documentElement.dataset.changes===undefined&&vis(del)&&vis(ins);
       const block=document.getElementById("ch2").classList.contains("chg-block")
         &&getComputedStyle(document.getElementById("ch2")).display==="block";
       document.title="RESULT::markup="+markup+",final="+fin+",original="+orig+",back="+back+",block="+block;`,
    );
    expect(out).toBe("markup=true,final=true,original=true,back=true,block=true");
  });
});

const PANEL_DOC = COLLAB_DOC.replace('<section id="s">', '<review/><section id="s">');

describe.skipIf(!BROWSER)("review panel runtime", () => {
  it("summarizes, groups and links the items", () => {
    const out = evaluate(
      compileSrc(PANEL_DOC),
      `const r=document.querySelector("delta-review .review");
       const stats=[...r.querySelectorAll(".review-stat")].map(s=>s.textContent.trim());
       const groups=[...r.querySelectorAll(".review-group-title")].map(g=>g.textContent);
       const items=r.querySelectorAll(".review-item").length;
       const jump=r.querySelector('.review-item[data-kind="comment"] .review-jump');
       document.title="RESULT::stats="+stats.join("|")+";groups="+groups.join("|")+";items="+items+";href="+jump.getAttribute("href");`,
    );
    expect(out).toBe(
      "stats=1 open comments|1 open tasks|2 pending changes|1 In review|1 Sketch|1 Draft;groups=Annotations|Tasks|Changes|blocks;items=8;href=#c-inline",
    );
  });

  it("drives the review switches and filters", () => {
    const out = evaluate(
      compileSrc(PANEL_DOC),
      `const r=document.querySelector("delta-review .review");
       const sw=r.querySelector(".review-switch");
       sw.click();
       const off=document.documentElement.dataset.review==="off"&&sw.getAttribute("aria-pressed")==="false";
       sw.click();
       const on=document.documentElement.dataset.review===undefined&&sw.getAttribute("aria-pressed")==="true";
       r.querySelector('.review-seg [data-mode="final"]').click();
       const fin=document.documentElement.dataset.changes==="final"&&r.querySelector('.review-seg [data-mode="final"]').classList.contains("is-active");
       r.querySelector('.review-filter[data-member="rb"]').click();
       const onlyRb=[...r.querySelectorAll(".review-item")].length;
       r.querySelector('.review-filter[data-member="rb"]').click();
       const all=[...r.querySelectorAll(".review-item")].length;
       document.title="RESULT::off="+off+",on="+on+",final="+fin+",rb="+onlyRb+",all="+all;`,
    );
    // rb authored c-on, ch2 and replied on c-inline (replies don't count) → 2 items
    expect(out).toBe("off=true,on=true,final=true,rb=2,all=8");
  });

  it("jumps to an item and flashes it", () => {
    const out = evaluate(
      compileSrc(PANEL_DOC),
      `const a=document.querySelector('delta-review .review-item[data-kind="todo"] .review-jump');
       a.click();
       const flashed=document.getElementById("t1").classList.contains("is-xref-target");
       document.title="RESULT::flashed="+flashed;`,
    );
    expect(out).toBe("flashed=true");
  });
});
