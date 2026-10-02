import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { main } from "../src/commands";

/**
 * The CLI's argv surface. Commands run in-process through `main(argv, io)` (src/commands.ts),
 * with stdout/stderr captured; `deltaIn` switches the working directory for the commands that
 * default to ./project.toml. Two smoke tests at the end spawn the real executable
 * (`node --import tsx src/cli.ts`) to check the entry point and the process exit code.
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
  const run: Run = { status: -1, stdout: "", stderr: "" };
  const before = process.cwd();
  process.chdir(cwd);
  try {
    run.status = main(args, {
      out: (t) => void (run.stdout += t),
      err: (t) => void (run.stderr += t),
    });
  } finally {
    process.chdir(before);
  }
  return run;
}

/** The real executable, as a child process. */
function spawnDelta(cwd: string, ...args: string[]): Run {
  const r = spawnSync(process.execPath, ["--import", TSX, resolve(ROOT, "src/cli.ts"), ...args], {
    cwd,
    encoding: "utf8",
  });
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
    expect(text).toContain(
      `<proof of="a" by="claude" status="verified" verified-by="rodrigo" against="${out.against}">p</proof>`,
    );
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
    for (const [, cmd] of r.stdout.matchAll(/delta ([a-z-]+)/g))
      expect(help).toContain(`delta ${cmd}`);
  });
});

describe("delta review", () => {
  it("defaults to ./project.toml, like the other commands", () => {
    const dir = mkdtempSync(join(tmpdir(), "delta-cli-review-"));
    writeFileSync(join(dir, "project.toml"), 'inputs = ["p.dlt"]\nout = "out"\n');
    writeFileSync(
      join(dir, "p.dlt"),
      `<document><section id="s"><title>S</title><todo for="a">x</todo></section></document>`,
    );
    const r = deltaIn(dir, "review", "--json");
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('"kind": "todo"');
  });
});

describe("delta verify on a proof without `of`", () => {
  it("finds and signs the proof that follows the result", () => {
    const dir = mkdtempSync(join(tmpdir(), "delta-cli-verify-implicit-"));
    writeFileSync(join(dir, "project.toml"), 'inputs = ["p.dlt"]\nout = "out"\n');
    writeFileSync(
      join(dir, "p.dlt"),
      `<document><section id="s"><title>S</title>
  <lemma id="a">A.</lemma>
  <proof/>
</section></document>`,
    );
    const r = deltaIn(dir, "verify", "a", "--by", "rodrigo");
    expect(r.status).toBe(0);
    expect(readFileSync(join(dir, "p.dlt"), "utf8")).toMatch(
      /<proof status="verified" verified-by="rodrigo" against="\w+"\/>/,
    );
  });
});

describe("argument parsing", () => {
  it("rejects an unknown flag, a flag without its value, and --project with positional inputs", () => {
    for (const args of [
      ["build", "x.dlt", "--bogus"],
      ["build", "x.dlt", "-o"],
      ["build", "--project", "p.toml", "x.dlt"],
    ]) {
      const r = delta(...args);
      expect(r.status, args.join(" ")).toBe(1);
      expect(r.stderr).toContain("usage: delta build");
    }
  });

  it("does not mistake an option value for --help", () => {
    const dir = mkdtempSync(join(tmpdir(), "delta-cli-args-"));
    writeFileSync(join(dir, "p.dlt"), "<document><todo>x</todo></document>");
    const r = deltaIn(dir, "review", "p.dlt", "--by=-h");
    expect(r.status).toBe(0);
    expect(r.stdout).not.toContain("usage:");
  });
});

describe("delta build", () => {
  it("writes the output next to a single input and reports it on stderr", () => {
    const dir = mkdtempSync(join(tmpdir(), "delta-cli-build-"));
    writeFileSync(join(dir, "a.dlt"), "<document><p>Hi.</p></document>");
    const r = deltaIn(dir, "build", "a.dlt");
    expect(r.status).toBe(0);
    expect(r.stderr).toBe("a.dlt → a.html\n");
    expect(readFileSync(join(dir, "a.html"), "utf8")).toContain("<delta-p>Hi.</delta-p>");
  });

  it("exits 1 without writing when the document has an error", () => {
    const dir = mkdtempSync(join(tmpdir(), "delta-cli-build-err-"));
    writeFileSync(join(dir, "a.dlt"), "<document><p>unclosed</document>");
    const r = deltaIn(dir, "build", "a.dlt");
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("error:");
    expect(existsSync(join(dir, "a.html"))).toBe(false);
  });
});

describe("the executable (spawned)", () => {
  it("prints the version and exits 0", () => {
    const r = spawnDelta(ROOT, "--version");
    expect(r.status).toBe(0);
    expect(r.stdout).toBe(`${VERSION}\n`);
  });

  it("exits 1 on a usage error", () => {
    const r = spawnDelta(ROOT);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("usage: delta build");
  });
});
