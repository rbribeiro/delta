import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, expect, it } from "./harness.ts";
import { bundlePack } from "../scripts/build.ts";
import { JS_EXTERNAL_REF } from "../src/compiler/imports.ts";
import { EXTERNAL_REF } from "../src/compiler/theme.ts";
import { BUILTIN_PACKS, CORE_CSS, RUNTIME_JS } from "../src/generated/assets.ts";

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

// -- the invariants every standard pack keeps ------------------------------------------------
// packs/README.md is the checklist these enforce; a new pack is covered with no edit here.

const PACKS = "packs";
const names = readdirSync(PACKS)
  .filter((n) => existsSync(join(PACKS, n, "delta.pack.json")))
  .sort();

/** Every file under `dir`, recursively, as paths relative to the repository. */
function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

/** The `delta-*` names a script registers. */
const defined = (js: string): string[] =>
  [...js.matchAll(/customElements\.define\(\s*["'`](delta-[a-z0-9-]+)["'`]/g)].map((m) => m[1]);

/** Comments out, so prose about colours or `any` does not count. */
const code = (text: string): string =>
  text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** A colour written as a value instead of a `--delta-*` token. */
const LITERAL_COLOUR =
  /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|:\s*(?:white|black|red|green|blue|gray|grey|yellow|orange|purple|pink|brown)\b/i;

describe("standard packs", () => {
  it("every packs/<name>/ with a manifest is built into BUILTIN_PACKS (else `npm run assets`)", () => {
    expect(Object.keys(BUILTIN_PACKS).sort()).toEqual(names);
  });

  it("ship no JavaScript source: packs are TypeScript", () => {
    expect(filesUnder(PACKS).filter((f) => /\.(?:js|mjs|cjs)$/.test(f))).toEqual([]);
  });

  it("no two packs claim the same tag", () => {
    const tags = names.flatMap((n) => BUILTIN_PACKS[n].tags);
    expect(tags.filter((t, i) => tags.indexOf(t) !== i)).toEqual([]);
  });
});

for (const name of names) {
  const pack = BUILTIN_PACKS[name];
  const dir = join(PACKS, name);
  const manifest = JSON.parse(readFileSync(join(dir, "delta.pack.json"), "utf8")) as Record<
    string,
    unknown
  >;

  describe(`standard pack ${name}`, () => {
    it("declares its tags and nothing a standard pack must not use", () => {
      expect(pack.tags.length, "tags must not be empty").toBeGreaterThan(0);
      expect(
        manifest.needs,
        "a standard pack has no `needs`: import modules instead",
      ).toBeUndefined();
    });

    it.each(filesUnder(dir).filter((f) => f.endsWith(".ts")))(
      "%s uses no any and no @ts-ignore",
      (file) => {
        const src = code(readFileSync(file, "utf8"));
        expect(src).not.toMatch(/(?::|<|,|\bas)\s*any\b|\bany\[\]/);
        expect(readFileSync(file, "utf8")).not.toMatch(/@ts-(?:ignore|nocheck|expect-error)/);
      },
    );

    it("registers exactly its tags", () => {
      expect(defined(pack.js).sort()).toEqual(pack.tags.map((t) => `delta-${t}`).sort());
    });

    it("claims no tag core registers or styles", () => {
      const core = new Set(defined(RUNTIME_JS));
      for (const tag of pack.tags) {
        expect(core.has(`delta-${tag}`), `core registers delta-${tag}`).toBe(false);
        expect(
          new RegExp(`delta-${tag}(?![\\w-])`).test(CORE_CSS),
          `core styles delta-${tag}`,
        ).toBe(false);
      }
    });

    it("has the same string keys in every language, each prefixed with the pack's name", () => {
      const langs = Object.values(pack.strings ?? {}).map((t) => Object.keys(t).sort());
      for (const keys of langs) expect(keys).toEqual(langs[0]);
      for (const key of langs[0] ?? []) expect(key.startsWith(`${name}.`), key).toBe(true);
    });

    it("references nothing external, and colours only through --delta-* tokens", () => {
      expect(JS_EXTERNAL_REF.test(pack.js)).toBe(false);
      if (pack.css === undefined) return;
      expect(EXTERNAL_REF.test(pack.css)).toBe(false);
      expect(code(pack.css)).not.toMatch(LITERAL_COLOUR);
    });
  });
}
