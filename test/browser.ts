import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A real browser for the few checks only a layout engine can make (hit-testing, overflow).
 * Suites using it `describe.skipIf(!BROWSER)`, so a machine with no Chromium (or one whose
 * Chromium cannot start, e.g. in a sandbox) stays green rather than pretending the check ran.
 * In CI (`CI` set, as GitHub Actions does) a missing browser is an error instead: there a
 * skipped runtime suite would let a broken element through.
 */

// --disable-component-update: no downloads in tests. Without it a run longer than a moment
// fetches and unpacks Chromium components (~18 MB each, left in a scoped_dir in TMPDIR).
const FLAGS = ["--headless=new", "--no-sandbox", "--disable-gpu", "--disable-component-update"];

/**
 * The environment for one browser start: its scratch files (profile, fetcher folders) go to
 * `scratch`, which the caller deletes, instead of piling up in the system's TMPDIR.
 */
function browserEnv(scratch: string): NodeJS.ProcessEnv {
  mkdirSync(scratch, { recursive: true });
  return { ...process.env, TMPDIR: scratch };
}

function findBrowser(): string | undefined {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const cmd of ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome"]) {
    try {
      // `which` rather than a shell, so no argument concatenation is involved.
      const p = execFileSync("which", [cmd], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      if (p.trim()) return p.trim();
    } catch {
      /* not installed — try the next one */
    }
  }
  return undefined;
}

/**
 * How long one start may take. Generous on purpose: every browser test file runs this check in
 * its own process, `node --test` runs files in parallel, and a cold Chrome on a small CI runner
 * can take well over 15 s when several start at once. A slow start is not a missing browser.
 */
const LAUNCH_TIMEOUT_MS = 60_000;

/** Why the browser did not start, for the warning and for the CI error. */
let launchFailure = "";

/**
 * True when `browser` starts and renders a blank page; a binary that is merely installed is not
 * enough. Tried twice, so one start lost to a busy machine does not fail a whole test file.
 */
function canLaunch(browser: string): boolean {
  for (let attempt = 1; attempt <= 2; attempt++) {
    const scratch = mkdtempSync(join(tmpdir(), "delta-chromium-"));
    try {
      execFileSync(browser, [...FLAGS, "--dump-dom", "about:blank"], {
        stdio: ["ignore", "ignore", "pipe"],
        timeout: LAUNCH_TIMEOUT_MS,
        env: browserEnv(scratch),
      });
      return true;
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { stderr?: Buffer };
      const stderr = err.stderr?.toString().trim().split("\n").slice(-5).join("\n");
      launchFailure =
        err.code === "ETIMEDOUT"
          ? `no page after ${LAUNCH_TIMEOUT_MS / 1000} s`
          : stderr || err.message;
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }
  console.warn(
    `test/browser.ts: ${browser} is installed but did not start (${launchFailure}); ` +
      "browser suites are skipped",
  );
  return false;
}

const found = findBrowser();
export const BROWSER = found && canLaunch(found) ? found : undefined;

if (process.env.CI && !BROWSER) {
  throw new Error(
    "test/browser.ts: CI is set but no browser started, so the runtime suites cannot run. " +
      (found
        ? `${found} failed to start: ${launchFailure}`
        : "None was found: install Chromium or Chrome, or point CHROME_PATH at one."),
  );
}

/**
 * First thing in `<head>`: records every uncaught error and unhandled rejection on the page
 * (the runtime's, a pack's, the probe's own timers) in `<html data-delta-errors>`, which the
 * dumped DOM carries back. A resource that fails to load (a missing image) is not an error
 * here: it does not reach a bubbling `error` listener on `window`.
 */
const ERROR_TRAP = `<script>(() => {
  const errors = [];
  const keep = (text) => {
    errors.push(text);
    document.documentElement.setAttribute("data-delta-errors", encodeURIComponent(JSON.stringify(errors)));
  };
  addEventListener("error", (e) => keep(e.error && e.error.stack ? String(e.error.stack) : String(e.message)));
  addEventListener("unhandledrejection", (e) => keep("unhandled rejection: " + String(e.reason && e.reason.stack || e.reason)));
})();</script>`;

/** The errors `ERROR_TRAP` recorded in a dumped DOM. */
function pageErrors(dom: string): string[] {
  const attr = /<html\b[^>]*\sdata-delta-errors="([^"]*)"/.exec(dom)?.[1];
  return attr ? (JSON.parse(decodeURIComponent(attr)) as string[]) : [];
}

/**
 * Renders `html` at `width` px with `probe` appended, and returns what the probe writes
 * after "RESULT::" into the document (the tests put it in document.title or the body).
 * Throws when the page had an uncaught error, so no browser test passes over a broken page.
 */
export function evaluate(html: string, probe: string, width = 1200): string {
  const dir = mkdtempSync(join(tmpdir(), "delta-hittest-"));
  const file = join(dir, "page.html");
  // A replacer function, not a string: in a replacement string `$$`, `$&` and `$'` are
  // substitutions, which would silently rewrite a probe that uses them.
  writeFileSync(
    file,
    html
      .replace("<head>", () => `<head>\n${ERROR_TRAP}`)
      .replace(
        "</body>",
        () =>
          `<script>window.addEventListener("load",()=>{setTimeout(()=>{${probe}},350);});</script></body>`,
      ),
  );
  let dom: string;
  try {
    dom = execFileSync(
      BROWSER!,
      [
        ...FLAGS,
        "--virtual-time-budget=2500",
        `--window-size=${width},900`,
        "--dump-dom",
        `file://${file}`,
      ],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 64 * 1024 * 1024,
        // Inside the page's folder, so it goes (or stays, for a failure) with the page.
        env: browserEnv(join(dir, "chromium")),
      },
    );
  } catch (e) {
    // Chromium's own stderr says why it failed; without it the test only reports "no RESULT".
    const stderr = (e as { stderr?: string }).stderr ?? "";
    throw new Error(`${BROWSER} failed on ${file}:\n${stderr}`, { cause: e });
  }
  const errors = pageErrors(dom);
  if (errors.length > 0) {
    throw new Error(`the page threw (kept at ${file}):\n${errors.join("\n")}`);
  }
  // Kept when the browser or the page failed (the error names it); otherwise ~1 MB per probe,
  // plus Chromium's scratch, piles up in /tmp.
  rmSync(dir, { recursive: true, force: true });
  return dom.match(/RESULT::([^<]*)/)?.[1] ?? "";
}
