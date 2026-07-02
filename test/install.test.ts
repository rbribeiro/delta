import { describe, expect, it } from "vitest";
import { parse } from "smol-toml";
import { addPackagesToToml } from "../src/install";

describe("addPackagesToToml", () => {
  it("appends to an existing packages array", () => {
    const out = addPackagesToToml(`inputs = ["a.dlt"]\npackages = []\n`, ["delta-callout"]);
    expect(out).toContain('packages = ["delta-callout"]');
    expect((parse(out) as any).packages).toEqual(["delta-callout"]);
  });

  it("merges without duplicating, preserving order", () => {
    const src = `packages = ["delta-callout"]\n`;
    const out = addPackagesToToml(src, ["delta-callout", "delta-quiz"]);
    expect((parse(out) as any).packages).toEqual(["delta-callout", "delta-quiz"]);
  });

  it("inserts before the first [table] when packages is absent, keeping the key top-level", () => {
    const src = [
      `# my project`,
      `inputs = ["a.dlt"]`,
      `out = "out"`,
      ``,
      `[document]`,
      `theme-accent = "blue"`,
      ``,
    ].join("\n");
    const out = addPackagesToToml(src, ["delta-callout"]);
    // The new key must parse as a top-level array, not inside [document].
    const data = parse(out) as any;
    expect(data.packages).toEqual(["delta-callout"]);
    expect(data.document).toEqual({ "theme-accent": "blue" });
    // Comments and other keys survive.
    expect(out).toContain("# my project");
    expect(out).toContain(`out = "out"`);
    // Ordering: packages appears before the [document] header.
    expect(out.indexOf("packages =")).toBeLessThan(out.indexOf("[document]"));
  });

  it("appends at EOF when there are no tables", () => {
    const out = addPackagesToToml(`inputs = ["a.dlt"]\n`, ["delta-callout"]);
    expect((parse(out) as any).packages).toEqual(["delta-callout"]);
  });

  it("preserves comments around an existing packages array", () => {
    const src = `inputs = ["a.dlt"]\n# add packages below\npackages = ["x"]  # inline note\n`;
    const out = addPackagesToToml(src, ["y"]);
    expect(out).toContain("# add packages below");
    expect((parse(out) as any).packages).toEqual(["x", "y"]);
  });

  it("throws when packages is malformed", () => {
    expect(() => addPackagesToToml(`packages = "not-a-list"\n`, ["x"])).toThrow(/list of strings/);
  });
});
