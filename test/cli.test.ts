import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The CLI's argv surface: `--version` / `--help` and the unchanged error path.
 * `src/cli.ts` runs `main()` on import, so it is spawned as a child process from
 * source (`node --import tsx`) rather than imported. `pretest` regenerates
 * `src/generated/assets.ts`, which the CLI transitively imports.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
// tsx is resolved from the repo, not from the working directory (tests run some commands elsewhere).
const TSX = pathToFileURL(resolve(ROOT, "node_modules/tsx/dist/loader.mjs")).href;
const VERSION: string = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version;

interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

function delta(...args: string[]): Run {
  return deltaIn(ROOT, ...args);
}

function deltaIn(cwd: string, ...args: string[]): Run {
  try {
    const stdout = execFileSync(process.execPath, ["--import", TSX, resolve(ROOT, "src/cli.ts"), ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { status: 0, stdout, stderr: "" };
  } catch (e) {
    const err = e as { status: number | null; stdout: string; stderr: string };
    return { status: err.status ?? -1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

describe("delta --version", () => {
  it("prints the package.json version on stdout and exits 0", () => {
    for (const flag of ["--version", "-v"]) {
      const r = delta(flag);
      expect(r.status).toBe(0);
      expect(r.stdout).toBe(`${VERSION}\n`);
      expect(r.stderr).toBe("");
    }
  });
});

describe("delta --help", () => {
  it("prints the usage on stdout and exits 0", () => {
    for (const flag of ["--help", "-h"]) {
      const r = delta(flag);
      expect(r.status).toBe(0);
      expect(r.stdout.startsWith("usage: delta build")).toBe(true);
      expect(r.stdout).toContain("--version");
      expect(r.stderr).toBe("");
    }
  });

  it("works after a subcommand", () => {
    const r = delta("build", "--help");
    expect(r.status).toBe(0);
    expect(r.stdout.startsWith("usage: delta build")).toBe(true);
  });
});

describe("usage errors", () => {
  it("still print the banner on stderr and exit 1 with no arguments", () => {
    const r = delta();
    expect(r.status).toBe(1);
    expect(r.stdout).toBe("");
    expect(r.stderr).toContain("usage: delta build");
  });
});

describe("the proof-graph commands", () => {
  const dir = mkdtempSync(join(tmpdir(), "delta-cli-graph-"));
  writeFileSync(join(dir, "project.toml"), 'inputs = ["p.dlt"]\nout = "out"\n');
  writeFileSync(
    join(dir, "p.dlt"),
    `<document><section id="s"><title>S</title>
  <lemma id="a">A.</lemma>
  <proof of="a" status="verified">p</proof>
  <theorem id="t">By <ref to="a"/>.</theorem>
</section></document>`,
  );
  writeFileSync(
    join(dir, "bad.dlt"),
    `<document><lemma id="a">A.</lemma><proof of="a" status="verified">By <ref to="a2"/>.</proof>
<lemma id="a2">B.</lemma><proof of="a2">By <ref to="a"/>.</proof></document>`,
  );

  it("default to ./project.toml and print JSON on stdout", () => {
    const r = deltaIn(dir, "graph", "--frontier", "--json");
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).frontier.map((n: { id: string }) => n.id)).toEqual(["t"]);
  });

  it("exit 0 from lint on a sound proof and 1 on a broken one", () => {
    expect(deltaIn(dir, "lint").status).toBe(0);
    const r = deltaIn(dir, "lint", "bad.dlt", "--json");
    expect(r.status).toBe(1);
    const kinds = JSON.parse(r.stdout).findings.map((f: { kind: string }) => f.kind);
    expect(kinds).toContain("cycle");
    expect(kinds).toContain("overclaimed");
  });

  it("exit 1 on an unknown id, and show the source of a known one", () => {
    const miss = deltaIn(dir, "show", "nope");
    expect(miss.status).toBe(1);
    expect(miss.stderr).toContain('no element with id "nope"');
    const hit = deltaIn(dir, "show", "t", "--context");
    expect(hit.status).toBe(0);
    expect(hit.stdout).toContain('<theorem id="t">By <ref to="a"/>.</theorem>');
    expect(hit.stdout).toContain('<lemma id="a">A.</lemma>');
  });
});
