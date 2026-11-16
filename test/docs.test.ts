import { readFileSync } from "node:fs";
import { describe, expect, it } from "./harness.ts";
import { PIPELINE } from "../src/compiler/pipeline.ts";

/**
 * The two places that describe the pipeline by hand: the phase table in docs/ARCHITECTURE.md
 * and the pt-BR descriptions the site's pipeline explorer shows (site/packs/pipeline/).
 * A step added to `PIPELINE` without them fails here, not months later in a reader's hands.
 */

const architecture = readFileSync("docs/ARCHITECTURE.md", "utf8");
const descriptions = JSON.parse(readFileSync("site/packs/pipeline/descriptions.json", "utf8")) as {
  phases: Record<string, string>;
  steps: Record<string, string>;
};

const phases = PIPELINE.map((p) => p.name);
const steps = PIPELINE.flatMap((p) => p.steps.map((s) => s.name));

describe("docs follow PIPELINE", () => {
  it.each(phases)("phase %s is in ARCHITECTURE.md and descriptions.json", (name) => {
    expect(architecture, "docs/ARCHITECTURE.md").toContain("`" + name + "`");
    expect(descriptions.phases[name], "descriptions.json phases").toBeDefined();
  });

  it.each(steps)("step %s is in ARCHITECTURE.md and descriptions.json", (name) => {
    expect(architecture, "docs/ARCHITECTURE.md").toContain("`" + name + "`");
    expect(descriptions.steps[name], "descriptions.json steps").toBeDefined();
  });

  it("descriptions.json describes no step that does not exist", () => {
    expect(Object.keys(descriptions.steps).filter((s) => !steps.includes(s))).toEqual([]);
    expect(Object.keys(descriptions.phases).filter((p) => !phases.includes(p))).toEqual([]);
  });
});
