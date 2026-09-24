import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * A real browser for the few checks only a layout engine can make (hit-testing, overflow).
 * Suites using it `describe.skipIf(!BROWSER)`, so a machine with no Chromium stays green
 * rather than pretending the check ran.
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

export const BROWSER = findBrowser();

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
  const dom = execFileSync(
    BROWSER!,
    [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--virtual-time-budget=2500",
      `--window-size=${width},900`,
      "--dump-dom",
      `file://${file}`,
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 },
  );
  return dom.match(/RESULT::([^<]*)/)?.[1] ?? "";
}

