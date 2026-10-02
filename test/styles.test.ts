import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const base = readFileSync("src/styles/base.css", "utf8");

/** The declarations of the first rule whose selector is `selector`, normalized. */
function declarations(css: string, selector: string): string[] {
  const at = css.indexOf(`${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf("{", at) + 1, css.indexOf("}", at));
  return body
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split(";")
    .map((d) => d.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

describe("base.css dark mode", () => {
  // CSS cannot share one declaration list between `[data-mode="dark"]` and the
  // `[data-mode="auto"]` + prefers-color-scheme case, so base.css writes it twice.
  it("keeps the dark and auto blocks identical", () => {
    expect(declarations(base, '[data-mode="auto"]')).toEqual(declarations(base, '[data-mode="dark"]'));
  });
});
