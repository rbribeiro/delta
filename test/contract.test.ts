import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "./harness.ts";
import { COMPILER_ATTRIBUTES } from "../src/language/contract.ts";

/**
 * Keeps src/language/contract.ts, the table of what the compiler writes for the runtime,
 * honest: every `data-*` name in compiler code has a row, and every row's writers and
 * readers still mention it. A student reading the table can trust it.
 */

/** Source without comments, so a name only mentioned in prose does not count. */
const code = (path: string): string =>
  readFileSync(path, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "$1");

const COMPILER = "src/compiler";
const compilerFiles = readdirSync(COMPILER).filter((f) => f.endsWith(".ts"));
const byName = new Map(COMPILER_ATTRIBUTES.map((a) => [a.name, a]));

/** `data-target-num` → `targetNum`, how `dataset` spells it. */
const camel = (name: string): string =>
  name.replace(/^data-/, "").replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());

/** True when `source` writes the attribute (a literal, or `attrs.name` for a plain one). */
function writes(source: string, name: string): boolean {
  if (name.startsWith("data-")) return source.includes(name);
  return new RegExp(`attrs\\.${name}\\b|["']${name}["']`).test(source);
}

/** True when `source` reads the attribute: by name, by `dataset`, or a CSS attribute selector. */
function reads(source: string, name: string): boolean {
  if (name.startsWith("data-")) {
    return new RegExp(`${name}(?![\\w-])|\\b${camel(name)}\\b`).test(source);
  }
  return new RegExp(`["']${name}["']|\\[${name}[\\]=~^$*|]`).test(source);
}

describe("the compiler → runtime contract (src/language/contract.ts)", () => {
  it("lists each attribute once", () => {
    expect(byName.size).toBe(COMPILER_ATTRIBUTES.length);
  });

  it("has a row for every data-* name the compiler writes", () => {
    const written = new Set(
      compilerFiles.flatMap((f) =>
        [...code(join(COMPILER, f)).matchAll(/\bdata-[a-z][a-z0-9-]*[a-z0-9]/g)].map((m) => m[0]),
      ),
    );
    expect([...written].filter((n) => !byName.has(n)).sort()).toEqual([]);
  });

  it.each(COMPILER_ATTRIBUTES.map((a) => a.name))("%s: its writers write it", (name) => {
    const row = byName.get(name)!;
    expect(row.writers.length, "a row names at least one writer").toBeGreaterThan(0);
    for (const w of row.writers)
      expect(writes(code(join(COMPILER, w)), name), `src/compiler/${w}`).toBe(true);
  });

  it.each(COMPILER_ATTRIBUTES.filter((a) => a.readers.length > 0).map((a) => a.name))(
    "%s: its readers read it",
    (name) => {
      for (const r of byName.get(name)!.readers)
        expect(reads(code(join("src", r)), name), `src/${r}`).toBe(true);
    },
  );

  it("a row without readers is a compile-time placeholder the page never carries", () => {
    const runtime = ["src/runtime", "src/styles"].flatMap(function all(dir: string): string[] {
      return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? all(join(dir, e.name))
          : /\.(ts|css)$/.test(e.name)
            ? [join(dir, e.name)]
            : [],
      );
    });
    for (const row of COMPILER_ATTRIBUTES.filter((a) => a.readers.length === 0)) {
      const found = runtime.filter((f) => reads(code(f), row.name));
      expect(found, `${row.name} is read by`).toEqual([]);
    }
  });
});
