import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadProjectConfig } from "../src/compiler/config";

/** Write a project.toml to a fresh temp dir and return its path. */
function writeToml(content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "delta-cfg-"));
  const path = join(dir, "project.toml");
  writeFileSync(path, content);
  return path;
}

describe("loadProjectConfig", () => {
  it("resolves inputs and out relative to the toml's directory", () => {
    const path = writeToml(`inputs = ["intro.dlt", "ch1.dlt"]\nout = "dist"`);
    const dir = join(path, "..");
    const { config, diagnostics } = loadProjectConfig(path);
    expect(diagnostics).toHaveLength(0);
    expect(config?.inputs).toEqual([join(dir, "intro.dlt"), join(dir, "ch1.dlt")]);
    expect(config?.outDir).toBe(join(dir, "dist"));
  });

  it("defaults the output directory to the toml's directory", () => {
    const path = writeToml(`inputs = ["a.dlt"]`);
    const { config } = loadProjectConfig(path);
    expect(config?.outDir).toBe(join(path, ".."));
  });

  it("errors on a missing or empty inputs list", () => {
    expect(loadProjectConfig(writeToml(`out = "dist"`)).config).toBeUndefined();
    const empty = loadProjectConfig(writeToml(`inputs = []`));
    expect(empty.config).toBeUndefined();
    expect(empty.diagnostics.some((d) => /inputs/.test(d.message))).toBe(true);
  });

  it("errors when out is not a string", () => {
    const { config, diagnostics } = loadProjectConfig(writeToml(`inputs = ["a.dlt"]\nout = 5`));
    expect(config).toBeUndefined();
    expect(diagnostics.some((d) => /out/.test(d.message))).toBe(true);
  });

  it("parses a packages list and sets root to the toml's directory", () => {
    const path = writeToml(`inputs = ["a.dlt"]\npackages = ["delta-foo", "../packs/x"]`);
    const { config, diagnostics } = loadProjectConfig(path);
    expect(diagnostics).toHaveLength(0);
    expect(config?.packages).toEqual(["delta-foo", "../packs/x"]);
    expect(config?.root).toBe(join(path, ".."));
  });

  it("omits packages when absent", () => {
    const { config } = loadProjectConfig(writeToml(`inputs = ["a.dlt"]`));
    expect(config?.packages).toBeUndefined();
  });

  it("errors when packages is not a list of strings", () => {
    expect(loadProjectConfig(writeToml(`inputs = ["a.dlt"]\npackages = "delta-foo"`)).config).toBeUndefined();
    const bad = loadProjectConfig(writeToml(`inputs = ["a.dlt"]\npackages = [1, 2]`));
    expect(bad.config).toBeUndefined();
    expect(bad.diagnostics.some((d) => /packages/.test(d.message))).toBe(true);
  });

  it("errors on invalid TOML", () => {
    const { config, diagnostics } = loadProjectConfig(writeToml(`inputs = [`));
    expect(config).toBeUndefined();
    expect(diagnostics.some((d) => /TOML/.test(d.message))).toBe(true);
  });

  it("errors when the project file is missing", () => {
    const { config, diagnostics } = loadProjectConfig("/no/such/project.toml");
    expect(config).toBeUndefined();
    expect(diagnostics.some((d) => /not found/.test(d.message))).toBe(true);
  });
});
