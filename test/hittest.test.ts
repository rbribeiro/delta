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
