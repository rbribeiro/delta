import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The CLI's argv surface: `--version` / `--help` and the unchanged error path.
 * `src/cli.ts` runs `main()` on import, so it is spawned as a child process from
 * source (`node --import tsx`) rather than imported. `pretest` regenerates
 * `src/generated/assets.ts`, which the CLI transitively imports.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const VERSION: string = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version;

interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

function delta(...args: string[]): Run {
  try {
    const stdout = execFileSync(process.execPath, ["--import", "tsx", "src/cli.ts", ...args], {
      cwd: ROOT,
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
