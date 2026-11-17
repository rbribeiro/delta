import { resolve } from "node:path";
import { describe, expect, it } from "../harness.ts";
import { BROWSER, evaluate } from "../browser.ts";
import { coreCss } from "../../scripts/build.ts";
import { compileFile } from "../../src/compiler/index.ts";
import { CORE_CSS } from "../../src/generated/assets.ts";

/**
 * The component stylesheets are concatenated in file-name order (scripts/build.ts), so the
 * order must not matter: a student adding `aaa.css` or `zzz.css` must not restyle anyone else.
 * The rule that guarantees it (base.css, at the top): a class styled by more than one
 * component file is a shell, in @layer delta.shells; a component refines shells and its own
 * classes, never another component's.
 *
 * The proof: on real pages, the computed style of every element (and of its ::before and
 * ::after) is the same with the components concatenated in reverse. One page load per
 * document: the probe records every style, swaps the core stylesheet for the reversed one,
 * records again and reports what changed. Transitions and animations are off, or a swap
 * would be caught mid-transition and hide the difference. Every pop-over is opened once
 * first, since a bubble's content is only built when it opens. A third snapshot, back in the
 * normal order, tells a real difference from layout that was still settling.
 */

const PAGES = [
  "site/ambientes.dlt",
  "site/colaboracao.dlt",
  "site/referencias.dlt",
  "site/estrutura.dlt",
  "site/layout.dlt",
  "site/midia.dlt",
  "site/matematica.dlt",
  "site/animacoes.dlt",
  "site/exemplos/artigo.dlt",
  "site/exemplos/apresentacao.dlt",
];

/** At most this many differences are reported per page: enough to see the pattern. */
const REPORT = 25;

const probe = (reversed: string): string => `
  const still = document.createElement("style");
  still.textContent = "*, *::before, *::after { transition: none !important; animation: none !important; }";
  document.head.append(still);
  // Bubbles (ref previews, threads, citation cards) are built on first open: open and close
  // each once, so their content is on the page to compare.
  let built = 0;
  for (const trigger of document.querySelectorAll('[aria-haspopup="dialog"]')) {
    trigger.click();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    built++;
  }
  const core = [...document.querySelectorAll("style")].find((s) => s.textContent.includes("@layer delta.base, delta.builtin"));
  const els = [...document.querySelectorAll("body *")];
  const name = (el) => el.localName + (el.id ? "#" + el.id : "") + (el.classList.length ? "." + [...el.classList].join(".") : "");
  const snapshot = () => els.map((el) => [null, "::before", "::after"].map((pseudo) => {
    const cs = getComputedStyle(el, pseudo);
    if (pseudo && (cs.content === "none" || cs.content === "normal")) return null;
    const out = {};
    for (const p of cs) out[p] = cs.getPropertyValue(p);
    return out;
  }));
  // Sorted, reversed, then sorted again. A value counts only when the two sorted snapshots
  // agree and the reversed one differs: something that moved on its own between snapshots
  // (layout still settling after load, on a busy machine) is not the file order.
  const original = core.textContent;
  const sorted = snapshot();
  core.textContent = ${JSON.stringify(reversed)};
  const after = snapshot();
  core.textContent = original;
  const again = snapshot();
  const diffs = [];
  let count = 0;
  els.forEach((el, i) => [null, "::before", "::after"].forEach((pseudo, k) => {
    const a = sorted[i][k], b = after[i][k], c = again[i][k];
    if (!a && !b) return;
    for (const p of new Set([...Object.keys(a || {}), ...Object.keys(b || {})])) {
      const va = a ? a[p] : "(no box)", vb = b ? b[p] : "(no box)", vc = c ? c[p] : "(no box)";
      if (va === vb || va !== vc) continue;
      count++;
      if (diffs.length < ${REPORT}) diffs.push(name(el) + (pseudo || "") + " " + p + ": " + va + " → " + vb);
    }
  }));
  document.title = "RESULT::" + encodeURIComponent(JSON.stringify({ elements: els.length, built, count, diffs }));`;

describe.skipIf(!BROWSER)("CSS file order", () => {
  const reversed = coreCss("reversed");

  it("the reversed concatenation is the same files, only in another order", () => {
    expect(reversed.length).toBe(CORE_CSS.length);
    expect(reversed).not.toBe(CORE_CSS);
  });

  it.each(PAGES)("%s looks the same with the component files in reverse order", (page) => {
    const { html } = compileFile(resolve(page));
    expect(html, `${page} did not compile`).toBeDefined();
    const raw = evaluate(html!, probe(reversed));
    // An empty result is the browser giving up before the probe finished (the heaviest page
    // reads ~2 million style values), not a difference: say so instead of a JSON error.
    if (!raw) throw new Error(`${page}: the probe did not finish (a slow or overloaded machine?)`);
    const { elements, built, count, diffs } = JSON.parse(decodeURIComponent(raw)) as {
      elements: number;
      built: number;
      count: number;
      diffs: string[];
    };
    console.log(`${page}: ${elements} elements, ${built} bubbles opened`);
    expect(elements, "the probe saw no elements").toBeGreaterThan(50);
    expect(diffs, `${count} computed values change with the file order`).toEqual([]);
  });
});
