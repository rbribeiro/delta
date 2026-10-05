import { BROWSER, evaluate } from "../browser.ts";
import { compileHtml } from "../helpers.ts";

export { BROWSER };

/**
 * Runtime tests run in the machine's Chromium (test/browser.ts): `inspect(dlt, script)`
 * compiles the document exactly as `delta build` would, loads it headless, waits for the
 * runtime to upgrade every element, runs `script` inside the page and returns what it
 * returns (anything JSON can carry). Suites wrap themselves in `describe.skipIf(!BROWSER)`,
 * so a machine without Chromium skips them instead of failing.
 *
 * A launch costs about a second, so a suite compiles one document, runs one script that
 * reads and clicks everything it needs, and lets each `it` assert on one field of the
 * result; `lazy()` makes that one launch happen on the first `it` only.
 *
 *   const facts = lazy(() => inspect(DOC, `click(".collapse-toggle"); return { folded: $("section").classList.contains("is-collapsed") };`));
 *   it("folds", () => expect(facts().folded).toBe(true));
 *
 * Inside the script: `$`, `$$` (query one/all), `text(sel)` (textContent or null),
 * `click(sel)`, `key(k, target?)` (a keydown), `openPopover()` (the bubble that is open),
 * and `await` (the script runs in an async function; `await sleep(ms)` lets a promise settle).
 */
export function inspect<T = Record<string, unknown>>(dlt: string, script: string, file = "test/doc.dlt"): T {
  const probe = `
    const $ = (s, root = document) => root.querySelector(s);
    const $$ = (s, root = document) => [...root.querySelectorAll(s)];
    const text = (s, root) => { const el = $(s, root); return el ? el.textContent : null; };
    const click = (s) => { const el = $(s); if (!el) throw new Error("nothing matches " + s); el.click(); };
    const key = (k, target = document) => target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
    const openPopover = () => $$(".delta-pop").find((p) => p.matches(":popover-open") || p.classList.contains("is-open")) ?? null;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    (async () => { ${script} })()
      .then((result) => ({ result }), (e) => ({ error: String((e && e.stack) || e) }))
      .then((out) => {
        const bytes = new TextEncoder().encode(JSON.stringify(out));
        let s = "";
        for (const b of bytes) s += String.fromCharCode(b);
        document.title = "RESULT::" + btoa(s);
      });`;
  const raw = evaluate(compileHtml(dlt, { file }), probe);
  if (!raw) throw new Error("the page produced no result: the runtime or the probe did not finish");
  const out = JSON.parse(Buffer.from(raw, "base64").toString("utf8")) as { result?: T; error?: string };
  if (out.error !== undefined) throw new Error(`the probe failed in the page:\n${out.error}`);
  return out.result as T;
}

/** Runs `fn` on the first call only and returns the same value afterwards. */
export function lazy<T>(fn: () => T): () => T {
  let value: T;
  let done = false;
  return () => {
    if (!done) {
      value = fn();
      done = true;
    }
    return value;
  };
}
