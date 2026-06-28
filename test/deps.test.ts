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
    expect(has("style/example.css")).toBe(true); // <document theme>
    expect(has("imports/mod/index.js")).toBe(true); // <import> pack
    expect(has("refs.ref")).toBe(true); // <bibliography src>
    expect(has("img.png")).toBe(true); // <figure src>

    // deps are absolute and unique.
    expect(deps.every((p) => p.startsWith("/"))).toBe(true);
    expect(new Set(deps).size).toBe(deps.length);
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
