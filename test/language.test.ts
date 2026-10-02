import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COUNTER_RESETS, ENVIRONMENTS } from "../src/language/environments";
import { STRINGS } from "../src/language/strings";
import {
  AID_TAGS,
  BLOCK_TAGS,
  ENVIRONMENT_TAGS,
  HEADING_TAGS,
  PROOF_TAGS,
  RESULT_TAGS,
} from "../src/language/tags";
import { TRUST, TRUST_OF } from "../src/language/trust";
import { PALETTE } from "../src/language/palette";

/**
 * The vocabulary in src/language/ is read by the compiler, the runtime and the CSS. These
 * checks catch an environment added to one list and forgotten in another, which would
 * otherwise render bare (no number, no label, inline) without any diagnostic.
 */
describe("the environment vocabulary agrees everywhere", () => {
  const css = readFileSync("src/styles/components/theorems.css", "utf8");

  for (const tag of ENVIRONMENT_TAGS) {
    it(`<${tag}> has a label in every language and is a block in theorems.css`, () => {
      for (const block of Object.values(STRINGS)) expect(block[tag], tag).toBeDefined();
      expect(css).toMatch(new RegExp(`\\bdelta-${tag}\\b`));
    });
  }

  it("numbers every box environment and heading", () => {
    for (const tag of ENVIRONMENT_TAGS)
      if (!PROOF_TAGS.has(tag)) expect(ENVIRONMENTS[tag], tag).toBeDefined();
    for (const tag of HEADING_TAGS) expect(ENVIRONMENTS[tag], tag).toBeDefined();
  });

  it("treats every environment and heading as a block (for <change>)", () => {
    for (const tag of [...ENVIRONMENT_TAGS, ...HEADING_TAGS])
      expect(BLOCK_TAGS.has(tag), tag).toBe(true);
  });

  it("restarts every section-numbered counter at a new section", () => {
    expect(COUNTER_RESETS.section).toContain("theorem");
    expect(COUNTER_RESETS.section).toContain("counterexample");
    expect(COUNTER_RESETS.section).toContain("equation");
    expect(COUNTER_RESETS.chapter).toEqual(["section"]);
    expect(COUNTER_RESETS.comment).toBeUndefined(); // collaboration counters never restart
  });

  it("has a result's every aid labelled", () => {
    for (const tag of AID_TAGS)
      for (const block of Object.values(STRINGS)) expect(block[tag], tag).toBeDefined();
    for (const tag of RESULT_TAGS) expect(ENVIRONMENT_TAGS.has(tag), tag).toBe(true);
  });
});

describe("trust and palette", () => {
  it("maps every block status to a trust level", () => {
    for (const trust of Object.values(TRUST_OF)) expect(TRUST).toContain(trust);
  });

  it("has a base.css accent block for every palette name", () => {
    const base = readFileSync("src/styles/base.css", "utf8");
    for (const name of PALETTE) expect(base).toContain(`[data-accent="${name}"]`);
  });
});
