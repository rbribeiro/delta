import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "./harness.ts";
import { ASSETS_FILE, renderAssets } from "../scripts/build.ts";

/**
 * `src/generated/assets.ts` is generated and not in git, so the copy on disk is whatever the
 * last `npm run assets` wrote, perhaps on another branch. `npm test` regenerates it first, but
 * `node --test`, `tsc` and the editor do not. This test is the alarm for that case.
 */
describe("generated assets", () => {
  it("src/generated/assets.ts matches the sources (else run `npm run assets`)", async () => {
    expect(existsSync(ASSETS_FILE), `${ASSETS_FILE} is missing: run \`npm run assets\``).toBe(true);
    const fresh = await renderAssets();
    const onDisk = readFileSync(ASSETS_FILE, "utf8");
    // A plain boolean, not toBe(fresh): the file is ≈1 MB and a diff of it helps no one.
    expect(onDisk === fresh, `${ASSETS_FILE} is stale: run \`npm run assets\``).toBe(true);
  });
});
