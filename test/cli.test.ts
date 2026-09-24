import { spawnSync } from "node:child_process";
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
  const r = spawnSync(process.execPath, ["--import", TSX, resolve(ROOT, "src/cli.ts"), ...args], { cwd, encoding: "utf8" });
  return { status: r.status ?? -1, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
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

describe("delta verify", () => {
  const dir = mkdtempSync(join(tmpdir(), "delta-cli-verify-"));
  writeFileSync(join(dir, "project.toml"), 'inputs = ["p.dlt"]\nout = "out"\n');
  const SRC = `<document><section id="s"><title>S</title>
  <definition id="d">D.</definition>
  <lemma id="a">A, by <ref to="d"/>.</lemma>
  <proof of="a" by="claude">p</proof>
  <lemma id="b" status="open">B.</lemma>
  <theorem id="t">By <ref to="a"/> and <ref to="b"/>.</theorem>
  <proof of="t" status="sketch">q</proof>
</section></document>`;
  writeFileSync(join(dir, "p.dlt"), SRC);

  it("signs the proof in place, pinned to a hash, and lint then accepts it", () => {
    const r = deltaIn(dir, "verify", "a", "--by", "rodrigo", "--json");
    expect(r.status).toBe(0);
    const out = JSON.parse(r.stdout);
    expect(out.against).toMatch(/^[0-9a-f]{12}$/);
    const text = readFileSync(join(dir, "p.dlt"), "utf8");
    expect(text).toContain(`<proof of="a" by="claude" status="verified" verified-by="rodrigo" against="${out.against}">p</proof>`);
    expect(text.replace(/ status="verified" verified-by="rodrigo" against="\w+"/, "")).toBe(SRC);
    expect(deltaIn(dir, "lint", "--json").stdout).not.toContain('"stale"');
  });

  it("warns, but signs, on top of an unverified result", () => {
    const r = deltaIn(dir, "verify", "t");
    expect(r.status).toBe(0);
    expect(r.stderr).toContain("t uses b, which is open");
  });

  it("refuses definitions, results without a proof, and unknown ids", () => {
    expect(deltaIn(dir, "verify", "d").status).toBe(1);
    expect(deltaIn(dir, "verify", "b").stderr).toContain("b has no proof yet");
    expect(deltaIn(dir, "verify", "nope").status).toBe(1);
  });
});

describe("delta agent-guide", () => {
  it("prints the conventions, and names only commands the CLI has", () => {
    const r = delta("agent-guide");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("delta graph --frontier --json");
    expect(r.stdout).toContain("delta show <id> --context");
    const help = delta("--help").stdout;
    for (const [, cmd] of r.stdout.matchAll(/delta ([a-z-]+)/g)) expect(help).toContain(`delta ${cmd}`);
  });
});
