import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse, TomlError } from "smol-toml";
import type { Diagnostic } from "./context";

/**
 * A resolved project: the ordered list of input `.dlt` files and the directory
 * their outputs are written to, both as absolute paths. Built from a `project.toml`
 * (`loadProjectConfig`) or assembled directly from CLI arguments.
 */
export interface ProjectConfig {
  /** Absolute paths to the input `.dlt` files, in declaration order. */
  inputs: string[];
  /** Absolute path to the output directory (outputs are saved as `<basename>.html` each). */
  outDir: string;
  /** Package specifiers applied to every file: a local path (relative to `root`) or a bare npm
   *  name resolved from `node_modules`. Raw strings — `resolvePack` resolves them. */
  packages?: string[];
  /** Absolute base directory (the toml's own directory) packages resolve against. */
  root?: string;
}

export interface ConfigResult {
  config?: ProjectConfig;
  diagnostics: Diagnostic[];
}

/**
 * Reads and validates a `project.toml`. The schema is intentionally small:
 *
 *   inputs   = ["intro.dlt", "ch1.dlt"]  # ordered, required, relative to the toml
 *   out      = "dist"                     # output directory, optional (default ".")
 *   packages = ["delta-callout", "../packs/x"]  # optional packages applied to every file
 *
 * Inputs and `out` are resolved relative to the toml's own directory. Each
 * document keeps declaring its own type/lang/theme — the project file only wires
 * the files together. Any problem is an `error` diagnostic on the toml.
 */
export function loadProjectConfig(tomlPath: string): ConfigResult {
  const diagnostics: Diagnostic[] = [];
  const fail = (message: string): ConfigResult => {
    diagnostics.push({ severity: "error", message, file: tomlPath });
    return { diagnostics };
  };

  let text: string;
  try {
    text = readFileSync(tomlPath, "utf8");
  } catch {
    return fail(`project file not found: ${tomlPath}`);
  }

  let data: unknown;
  try {
    data = parse(text);
  } catch (e) {
    const where = e instanceof TomlError ? ` (line ${e.line}, column ${e.column})` : "";
    return fail(`invalid TOML${where}: ${e instanceof Error ? e.message : String(e)}`);
  }

  const table = data as Record<string, unknown>;
  const inputs = table.inputs;
  if (!Array.isArray(inputs) || inputs.length === 0) {
    return fail("project.toml needs a non-empty `inputs` array of .dlt paths");
  }
  if (!inputs.every((i) => typeof i === "string")) {
    return fail("`inputs` must be a list of strings");
  }
  if (table.out !== undefined && typeof table.out !== "string") {
    return fail("`out` must be a string (the output directory)");
  }
  if (
    table.packages !== undefined &&
    (!Array.isArray(table.packages) || !table.packages.every((p) => typeof p === "string"))
  ) {
    return fail("`packages` must be a list of strings (package names or local paths)");
  }

  const base = dirname(tomlPath);
  return {
    diagnostics,
    config: {
      inputs: (inputs as string[]).map((i) => resolve(base, i)),
      outDir: resolve(base, (table.out as string | undefined) ?? "."),
      packages: table.packages as string[] | undefined,
      root: base,
    },
  };
}
