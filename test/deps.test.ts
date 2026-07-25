import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import { compileFile } from "../src/compiler/index";
import { loadProjectConfig } from "../src/compiler/config";
import { compileProject } from "../src/compiler/project";

// hello.dlt exercises every dependency kind: <include>, <document theme>, <import>
// pack, <bibliography src>, and <figure src> — so its dep set covers them all.
describe("dependency tracking (for --watch)", () => {
  it("records every user file a single-file compile reads", () => {
    const { deps } = compileFile(resolve("examples/hello.dlt"));
    const has = (p: string) => deps.includes(resolve("examples", p));

    expect(has("hello.dlt")).toBe(true); // the entry file
    expect(has("include.dlt")).toBe(true); // <include>
    expect(has("includeElement.dlt")).toBe(true); // <include target-id>
    expect(has("imports/mod/index.js")).toBe(true); // <import> pack
    expect(has("refs.ref")).toBe(true); // <bibliography src>
    expect(has("img.png")).toBe(true); // <figure src>
    // NB: `<document theme>` is covered by its own test below, against a fixture —
    // hello.dlt is a demo file whose theme may be switched to a *built-in* (which
    // is correctly not a dep, since it ships inside the compiler), and that must
    // not break dependency tracking's test.

    // deps are absolute and unique.
    expect(deps.every((p) => p.startsWith("/"))).toBe(true);
    expect(new Set(deps).size).toBe(deps.length);
  });

  it("records an author theme file, but not a built-in theme", () => {
    const withFile = compileFile(resolve("test/fixtures/theme-dep.dlt"));
    expect(withFile.deps).toContain(resolve("test/fixtures/theme.css"));

    // A built-in ships inside the compiler: there is no user file to watch, and a
    // phantom dep would make --watch wait on a path that does not exist.
    const withBuiltin = compileFile(resolve("test/fixtures/theme-builtin.dlt"));
    expect(withBuiltin.deps).toEqual([resolve("test/fixtures/theme-builtin.dlt")]);
  });

  it("unions deps across every input on the project path", () => {
    const { config } = loadProjectConfig(resolve("examples/project/project.toml"));
    expect(config).toBeDefined();
    const { deps } = compileProject(config!);

    expect(deps).toContain(resolve("examples/project/ch1-geometry.dlt"));
    expect(deps).toContain(resolve("examples/project/ch2-algebra.dlt"));
    expect(deps).toContain(resolve("examples/project/refs.ref")); // shared bibliography
  });
});
