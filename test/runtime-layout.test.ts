import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "./harness.ts";

/**
 * The runtime's folder layout says what each file is (docs/ARCHITECTURE.md, file map):
 * `src/runtime/elements/` holds the files that register tags, and everything else in
 * `src/runtime/` is shared library. A student looking for a helper should never have to
 * guess that it lives in some element's file.
 */

const RUNTIME = "src/runtime";
const ELEMENTS = join(RUNTIME, "elements");

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith(".ts") ? [p] : [];
  });
}

/** The module specifiers a file imports (`import … from "x"` and `export … from "x"`). */
const importsOf = (file: string): string[] =>
  [...readFileSync(file, "utf8").matchAll(/^(?:import|export)\b[^;]*?\bfrom\s+"([^"]+)"/gms)].map(
    (m) => m[1],
  );

describe("runtime layout", () => {
  it.each(tsFiles(ELEMENTS).filter((f) => !f.endsWith("index.ts")))(
    "%s registers a tag",
    (file) => {
      expect(readFileSync(file, "utf8")).toMatch(/customElements\.define\(/);
    },
  );

  it("outside elements/, only the entry imports elements/, and only elements/index.ts", () => {
    const crossings = tsFiles(RUNTIME)
      .filter((f) => !f.startsWith(ELEMENTS))
      .flatMap((f) =>
        importsOf(f)
          .filter((spec) => spec.includes("elements/"))
          .map((spec) => `${relative(RUNTIME, f)} → ${spec}`),
      );
    expect(crossings).toEqual(["index.ts → ./elements/index.ts"]);
  });
});

describe("the DOM contracts between elements (src/runtime/contracts.ts)", () => {
  const contracts = readFileSync(join(RUNTIME, "contracts.ts"), "utf8");
  // The classes contracts.ts selects on, from its code (its comments name them too).
  const code = contracts.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const relied = [...new Set([...code.matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]))].filter(
    (c) => !["closest", "classList", "contains", "querySelector", "parentElement"].includes(c),
  );
  const builders = tsFiles(ELEMENTS)
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");

  it("relies on the classes it names", () => {
    expect(relied.sort()).toEqual(["box-head", "box-sheet", "proof-bar", "proof-lead"]);
  });

  it.each(["box-head", "box-sheet", "proof-bar", "proof-lead"])(
    "an element still builds .%s",
    (cls) => {
      expect(builders).toContain(`className = "${cls}"`);
    },
  );

  it("the preview body is built from the one name", () => {
    expect(builders).toContain("className = PREVIEW_BODY");
  });
});
