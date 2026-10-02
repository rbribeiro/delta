import { afterEach } from "vitest";
import { VirtualConsoleLogLevelEnum, Window as HappyWindow } from "happy-dom";
import { compileSource } from "../../src/compiler/index";
import { createContext } from "../../src/compiler/context";

/**
 * Runtime tests without a browser. `mount(dlt)` compiles a document exactly as `delta build`
 * would and loads the HTML into a fresh happy-dom window, which runs the page's own inlined
 * runtime (the bundled RUNTIME_JS, as it ships). Each mount is a new window, so custom
 * elements, island caches and listeners never leak between tests; every window is closed
 * after the test.
 *
 *   const page = await mount(`<document><theorem>…</theorem></document>`);
 *   expect(page.$(".box-tag")?.textContent).toBe("Theorem 1");
 *   page.click(".collapse-toggle");
 *
 * An error the page logs (an exception in a click handler, say) fails the test: happy-dom
 * would otherwise swallow it, and the test would only see that nothing happened.
 *
 * happy-dom does no layout: positions, sizes and scrolling are not real. What depends on
 * them (hit-testing, overflow) stays in the Chromium tests (test/browser.ts).
 */

export interface Page {
  document: Document;
  window: Window & typeof globalThis;
  /** The first element matching `selector`, or null. */
  $(selector: string): HTMLElement | null;
  /** Every element matching `selector`. */
  $$(selector: string): HTMLElement[];
  /** Clicks the first element matching `selector`; throws if there is none. */
  click(selector: string): void;
  /**
   * The pop-over bubble that is open now (the runtime moves every bubble to the end of
   * <body>). happy-dom has no Popover API, so the runtime takes its fallback and marks the
   * open bubble `.is-open`; real browsers take the `showPopover()` path, which the Chromium
   * tests cover.
   */
  openPopover(): HTMLElement | undefined;
  /** Dispatches a keydown of `key` on the first element matching `selector` (the document when omitted). */
  key(key: string, selector?: string): void;
}

const open: HappyWindow[] = [];
afterEach(async () => {
  const windows = open.splice(0);
  const errors = windows.flatMap((w) =>
    w.happyDOM.virtualConsolePrinter
      .read()
      .filter((entry) => entry.level >= VirtualConsoleLogLevelEnum.error)
      .map((entry) => entry.message.map(String).join(" ")),
  );
  await Promise.all(windows.map((w) => w.happyDOM.close()));
  if (errors.length) throw new Error(`the page logged errors:\n${errors.join("\n")}`);
});

export async function mount(dlt: string, file = "test.dlt"): Promise<Page> {
  const ctx = createContext(file);
  const html = compileSource(dlt, ctx);
  if (html === undefined) {
    throw new Error(
      `the document did not compile:\n${ctx.diagnostics.map((d) => d.message).join("\n")}`,
    );
  }
  const window = new HappyWindow({
    url: `file:///${file.replace(/\.dlt$/, ".html")}`,
    // The page runs its own inlined runtime; the documents are ours, so the sandbox warning is noise.
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
      disableCSSFileLoading: true,
    },
  });
  open.push(window);
  window.document.write(html);
  await window.happyDOM.waitUntilComplete();

  const document = window.document as unknown as Document;
  const $ = (selector: string) => document.querySelector<HTMLElement>(selector);
  return {
    document,
    window: window as unknown as Window & typeof globalThis,
    $,
    $$: (selector) => [...document.querySelectorAll<HTMLElement>(selector)],
    openPopover: () => document.querySelector<HTMLElement>(".delta-pop.is-open") ?? undefined,
    click(selector) {
      const el = $(selector);
      if (!el) throw new Error(`nothing matches ${selector}`);
      el.click();
    },
    key(key, selector) {
      const target = selector ? $(selector) : document;
      if (!target) throw new Error(`nothing matches ${selector}`);
      target.dispatchEvent(
        new window.KeyboardEvent("keydown", { key, bubbles: true }) as unknown as Event,
      );
    },
  };
}
