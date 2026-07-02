import { describe, expect, it } from "vitest";
import { scaffoldFiles, tagFor } from "../src/scaffold";

describe("tagFor", () => {
  it("strips a leading delta- prefix, else uses the name", () => {
    expect(tagFor("delta-callout")).toBe("callout");
    expect(tagFor("my-widget")).toBe("my-widget");
  });
});

describe("scaffoldFiles project", () => {
  it("yields exactly a project.toml and a starter main.dlt", () => {
    const files = scaffoldFiles("project", "my-book");
    expect(Object.keys(files).sort()).toEqual(["main.dlt", "project.toml"]);
    // The empty packages array is the anchor `delta install` updates.
    expect(files["project.toml"]).toContain("packages = []");
    expect(files["project.toml"]).toContain('inputs = ["main.dlt"]');
    // The [document] defaults block is present but commented (a hint, not active).
    expect(files["project.toml"]).toContain("# [document]");
    expect(files["main.dlt"]).toContain("<document>");
    expect(files["main.dlt"]).toContain("<title>");
  });
});

describe("scaffoldFiles package", () => {
  it("yields a publishable pack skeleton with a valid manifest", () => {
    const files = scaffoldFiles("package", "delta-callout");
    expect(Object.keys(files).sort()).toEqual([
      ".gitignore",
      "README.md",
      "package.json",
      "src/index.js",
      "src/theme.css",
      "test/smoke.mjs",
    ]);

    const pkg = JSON.parse(files["package.json"]);
    expect(pkg.name).toBe("delta-callout");
    expect(pkg.files).toEqual(["dist"]);
    // The delta manifest points at the minified artifacts and declares the tag.
    expect(pkg.delta).toMatchObject({
      js: "dist/pack.min.js",
      css: "dist/pack.min.css",
      tags: ["callout"],
    });
    // build (minify) + test (smoke) + a publish gate that runs both.
    expect(pkg.scripts.build).toContain("--minify");
    expect(pkg.scripts.test).toBe("node test/smoke.mjs");
    expect(pkg.scripts.prepublishOnly).toBe("npm run build && npm test");
    expect(pkg.devDependencies.esbuild).toBeDefined();
  });

  it("registers delta-<tag> and scopes the css to it", () => {
    const files = scaffoldFiles("package", "delta-callout");
    expect(files["src/index.js"]).toContain('customElements.define(\n  "delta-callout"');
    expect(files["src/index.js"]).toContain("this.dataset.deltaReady"); // the move-guard convention
    expect(files["src/theme.css"]).toContain("delta-callout {");
    expect(files["src/theme.css"]).toContain("--delta-"); // reuses design tokens
    // The smoke test checks the built artifact for the registered element.
    expect(files["test/smoke.mjs"]).toContain("delta-callout");
    expect(files["test/smoke.mjs"]).toContain("dist/pack.min.js");
  });

  it("derives the tag from a bare name", () => {
    const files = scaffoldFiles("package", "my-widget");
    expect(JSON.parse(files["package.json"]).delta.tags).toEqual(["my-widget"]);
    expect(files["src/index.js"]).toContain('"delta-my-widget"');
  });
});
