import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A real browser for the few checks only a layout engine can make (hit-testing, overflow).
 * Suites using it `describe.skipIf(!BROWSER)`, so a machine with no Chromium (or one whose
 * Chromium cannot start, e.g. in a sandbox) stays green rather than pretending the check ran.
 */

const FLAGS = ["--headless=new", "--no-sandbox", "--disable-gpu"];

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

/** True when `browser` starts and renders a blank page; a binary that is merely installed is not enough. */
function canLaunch(browser: string): boolean {
  try {
    execFileSync(browser, [...FLAGS, "--dump-dom", "about:blank"], { stdio: "ignore", timeout: 15_000 });
    return true;
  } catch {
    console.warn(`test/browser.ts: ${browser} is installed but did not start; browser suites are skipped`);
    return false;
  }
}

const found = findBrowser();
export const BROWSER = found && canLaunch(found) ? found : undefined;

/**
 * Renders `html` at `width` px with `probe` appended, and returns what the probe writes
 * after "RESULT::" into the document (the tests put it in document.title or the body).
 */
export function evaluate(html: string, probe: string, width = 1200): string {
  const dir = mkdtempSync(join(tmpdir(), "delta-hittest-"));
  const file = join(dir, "page.html");
  writeFileSync(
    file,
    html.replace(
      "</body>",
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
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 },
    );
  } catch (e) {
    // Chromium's own stderr says why it failed; without it the test only reports "no RESULT".
    const stderr = (e as { stderr?: string }).stderr ?? "";
    throw new Error(`${BROWSER} failed on ${file}:\n${stderr}`, { cause: e });
  }
  return dom.match(/RESULT::([^<]*)/)?.[1] ?? "";
}

