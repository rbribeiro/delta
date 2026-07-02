/**
 * `delta install <pkg>…`: run `npm install` in the project, then append each package
 * to `project.toml`'s `packages` list so it inlines into every output. The TOML edit
 * is comment-preserving (text surgery, not parse→stringify), so a scaffolded, commented
 * project file survives intact. `addPackagesToToml` is pure and unit-tested; the npm
 * side effects live in `installPackages`.
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "smol-toml";

/** A `[table]` / `[[table]]` header at the start of a line — packages must go *before* the first. */
const TABLE_HEADER = /^\s*\[/m;
/** A top-level `packages = [ … ]` array (lazy to the first `]`; package arrays hold only strings). */
const PACKAGES_ARRAY = /^packages\s*=\s*\[[\s\S]*?\]/m;

/** A TOML basic string with the two characters that need escaping handled. */
function quote(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** The current top-level `packages` list, via a real parse; throws if it is malformed. */
function currentPackages(text: string): string[] {
  const data = parse(text) as Record<string, unknown>;
  const p = data.packages;
  if (p === undefined) return [];
  if (!Array.isArray(p) || !p.every((x) => typeof x === "string")) {
    throw new Error("`packages` in project.toml must be a list of strings");
  }
  return p as string[];
}

/**
 * Returns `text` with `pkgs` merged into the top-level `packages` array (deduped,
 * order-preserving). Rewrites an existing `packages = [ … ]` in place, or — if there is
 * none — inserts one *before the first `[table]` header* (never at EOF, which would fall
 * inside a table like `[document]`). All comments and other keys are preserved.
 */
export function addPackagesToToml(text: string, pkgs: string[]): string {
  const merged = [...currentPackages(text)];
  for (const p of pkgs) if (!merged.includes(p)) merged.push(p);
  const line = `packages = [${merged.map(quote).join(", ")}]`;

  if (PACKAGES_ARRAY.test(text)) return text.replace(PACKAGES_ARRAY, line);

  const header = TABLE_HEADER.exec(text);
  if (header) return text.slice(0, header.index) + line + "\n\n" + text.slice(header.index);

  // No tables at all: appending at EOF keeps the key top-level.
  return text.replace(/\n*$/, "") + "\n" + line + "\n";
}

export interface InstallOptions {
  /** Where to look for `project.toml` when `projectFile` is not given (default `process.cwd()`). */
  cwd?: string;
  /** An explicit `--project <file>` path. */
  projectFile?: string;
}

/**
 * Runs `npm install <pkgs>` in the project directory, then records the packages in
 * `project.toml`. Returns whether it succeeded; reports its own diagnostics (like the
 * build path). npm populates `node_modules`, which is all `resolvePack` needs; saving the
 * dependency to a `package.json` is left to the author.
 */
export function installPackages(pkgs: string[], opts: InstallOptions = {}): boolean {
  const cwd = opts.cwd ?? process.cwd();
  const tomlPath = opts.projectFile ? resolve(opts.projectFile) : resolve(cwd, "project.toml");
  if (!existsSync(tomlPath)) {
    console.error(`error: no project.toml found at ${tomlPath}`);
    console.error("hint: run `delta create project <name>` first, or pass --project <file>.");
    return false;
  }
  const projectDir = dirname(tomlPath);

  const npm = spawnSync("npm", ["install", ...pkgs], {
    cwd: projectDir,
    stdio: "inherit",
    shell: process.platform === "win32", // npm is npm.cmd on Windows
  });
  if (npm.status !== 0) {
    console.error(`error: npm install failed (exit ${npm.status ?? npm.signal ?? "unknown"})`);
    return false;
  }

  const text = readFileSync(tomlPath, "utf8");
  let updated: string;
  try {
    updated = addPackagesToToml(text, pkgs);
  } catch (e) {
    console.error(`error: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
  if (updated !== text) {
    writeFileSync(tomlPath, updated);
    console.error(`→ added ${pkgs.join(", ")} to ${tomlPath}`);
  } else {
    console.error(`${pkgs.join(", ")} already listed in ${tomlPath}`);
  }
  return true;
}
