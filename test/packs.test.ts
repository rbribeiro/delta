import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, expect, it } from "./harness.ts";
import { bundlePack } from "../scripts/build.ts";

/**
 * Standard packs (`packs/<name>/`): the rules the build enforces on every pack. The
 * invariants every shipped pack must keep are in the second half of this file.
 */

/** A pack folder in a fresh temp dir: `files` is name → contents, next to a sibling `shared.ts`. */
function scratchPack(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "delta-pack-"));
  writeFileSync(join(root, "shared.ts"), `export const shared = 1;\n`);
  const dir = join(root, "p");
  mkdirSync(dir);
  for (const [name, text] of Object.entries(files)) writeFileSync(join(dir, name), text);
  return dir;
}

describe("bundlePack", () => {
  it("bundles the modules of one pack into one script, with its css and tags", async () => {
    const dir = scratchPack({
      "delta.pack.json": `{"tags": ["p"]}`,
      "index.ts": `import { n } from "./n.ts";\ncustomElements.define("delta-p", class extends HTMLElement { x = n; });\n`,
      "n.ts": `export const n = 42;\n`,
      "theme.css": `delta-p { display: block; }\n`,
    });
    const pack = await bundlePack(dir);
    expect(pack.js).toContain("delta-p");
    expect(pack.js).toContain("42");
    expect(pack.js).not.toMatch(/\bimport\b|\bexport\b/);
    expect(pack.css).toContain("delta-p");
    expect(pack.tags).toEqual(["p"]);
  });

  it("refuses a JavaScript entry", async () => {
    const dir = scratchPack({ "delta.pack.json": `{"js": "index.js"}`, "index.js": `1;\n` });
    await assert.rejects(bundlePack(dir), /index\.js: a standard pack's entry must be a \.ts file/);
  });

  it("refuses a value import from outside the pack, naming the file", async () => {
    const dir = scratchPack({
      "delta.pack.json": `{}`,
      "index.ts": `import { shared } from "../shared.ts";\nconsole.log(shared);\n`,
    });
    await assert.rejects(bundlePack(dir), /pulls in .*shared\.ts, which is outside the pack/);
  });

  it("accepts a type-only import from outside the pack (it is erased)", async () => {
    const dir = scratchPack({
      "delta.pack.json": `{}`,
      "index.ts": `import type { shared } from "../shared.ts";\nconst x: typeof shared = 1;\nconsole.log(x);\n`,
    });
    expect((await bundlePack(dir)).js).toContain("console.log");
  });

  it("fails when the manifest names a css file that is missing", async () => {
    const dir = scratchPack({ "delta.pack.json": `{"css": "nope.css"}`, "index.ts": `1;\n` });
    await assert.rejects(bundlePack(dir), /nope\.css: named in delta\.pack\.json but missing/);
  });
});
