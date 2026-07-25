import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse, TomlError } from "smol-toml";
import type { Diagnostic } from "./context";
import { isBuiltinThemeName } from "./theme";

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
  /** `<document>` defaults applied to every file (attribute name → value), each overridable by a
   *  per-document attribute. A `theme` naming a *file* is stored as an absolute path (resolved
   *  against the toml dir); one naming a *built-in* rides raw, like every other value. Built from
   *  the `[document]` table. */
  document?: Record<string, string>;
}

/** The `<document>` attributes a project may default via the `[document]` table. Only a
 *  path-shaped `theme` needs resolution; the rest ride raw onto `doc.attrs`. Any other key
 *  is ignored. */
const DOCUMENT_DEFAULT_KEYS = ["type", "theme", "theme-accent", "theme-mode", "lang"] as const;

export interface ConfigResult {
  config?: ProjectConfig;
  diagnostics: Diagnostic[];
}

/**
 * Reads and validates a `project.toml`. 
 *
 *   inputs   = ["intro.dlt", "ch1.dlt"]  # ordered, required, relative to the toml
 *   out      = "dist"                     # output directory, optional (default ".")
 *   packages = ["delta-callout", "../packs/x"]  # optional packages applied to every file
 *   [document]                             # optional <document> defaults, applied to every file
 *   type         = "book"                  #   (each overridable by a per-document attribute)
 *   theme        = "impatech"              #   a built-in theme name, or a path to
 *                                          #   your own CSS relative to the toml
 *   theme-accent = "blue"
 *   theme-mode   = "dark"
 *   lang         = "en"
 *
 * Inputs and `out` are resolved relative to the toml's own directory. The optional
 * `[document]` table sets defaults (`type`/`theme`/`theme-accent`/`theme-mode`/`lang`)
 * applied to every file, each overridable by a per-document attribute. Any problem is
 * an `error` diagnostic on the toml.
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

  // Optional `[document]` defaults: a table of `<document>` attribute overrides applied to every
  // file. A path-shaped `theme` becomes absolute (so the per-doc `resolveTheme`, which resolves
  // relative to each file, passes it through unchanged); a built-in name and the rest ride raw.
  // Unknown keys are ignored.
  let document: Record<string, string> | undefined;
  if (table.document !== undefined) {
    const dt = table.document;
    if (typeof dt !== "object" || dt === null || Array.isArray(dt)) {
      return fail("`[document]` must be a table of document defaults");
    }
    const entries = dt as Record<string, unknown>;
    const built: Record<string, string> = {};
    for (const key of DOCUMENT_DEFAULT_KEYS) {
      const v = entries[key];
      if (v === undefined) continue;
      if (typeof v !== "string") return fail(`\`document.${key}\` must be a string`);
      // `theme` may name a built-in rather than point at a file; a bare name is
      // not a path, so it rides through raw for resolveTheme to look up.
      built[key] = key === "theme" && !isBuiltinThemeName(v) ? resolve(base, v) : v;
    }
    if (Object.keys(built).length > 0) document = built;
  }

  return {
    diagnostics,
    config: {
      inputs: (inputs as string[]).map((i) => resolve(base, i)),
      outDir: resolve(base, (table.out as string | undefined) ?? "."),
      packages: table.packages as string[] | undefined,
      root: base,
      document,
    },
  };
}
