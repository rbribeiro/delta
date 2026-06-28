#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { compileFile } from "./compiler/index";
import { loadProjectConfig } from "./compiler/config";
import { compileProject, type ProjectResult } from "./compiler/project";
import type { Diagnostic } from "./compiler/context";

/** The CLI source entry point.
 * It parses command-line arguments, loads a project config if requested, and calls the compiler. It reports diagnostics and writes outputs to disk. It exits with a non-zero code if there were any errors.
 */

function usage(): never {
  console.error("usage: delta build <file.dlt> [-o out.html]");
  console.error("       delta build <a.dlt> <b.dlt> ... [-o out-dir]   # multi-file project");
  console.error("       delta build <project.toml> [-o out-dir]        # project file");
  process.exit(1);
}

function report(d: Diagnostic): void {
  const where = d.pos ? `${d.file}:${d.pos.line}:${d.pos.column}` : d.file;
  console.error(`${d.severity}: ${d.message} (${where})`);
}

function hasError(diags: Diagnostic[]): boolean {
  return diags.some((d) => d.severity === "error");
}

/** Report a project's diagnostics and, if it succeeded, write every output. */
function writeProject(result: ProjectResult): void {
  for (const d of result.diagnostics) report(d);
  if (hasError(result.diagnostics)) process.exit(1);
  for (const o of result.outputs) {
    mkdirSync(dirname(o.path), { recursive: true });
    writeFileSync(o.path, o.html);
    console.error(`→ ${o.path}`);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.shift() !== "build" || args.length === 0) usage();

  let output: string | undefined;
  let projectFile: string | undefined;
  const inputs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") output = args[++i] ?? usage();
    else if (arg === "--project") projectFile = args[++i] ?? usage();
    else if (arg.startsWith("-")) usage();
    else inputs.push(arg);
  }

  // A project file: --project <f>, or a single positional .toml.
  if (!projectFile && inputs.length === 1 && inputs[0].endsWith(".toml")) projectFile = inputs[0];
  if (projectFile) {
    const { config, diagnostics } = loadProjectConfig(projectFile);
    for (const d of diagnostics) report(d);
    if (!config) process.exit(1);
    if (output) config.outDir = resolve(output); // -o overrides the toml's `out`
    writeProject(compileProject(config));
    return;
  }

  if (inputs.length === 0) usage();

  // Several .dlt inputs compile as one project (shared numbering, cross-file refs).
  if (inputs.length > 1) {
    writeProject(compileProject({ inputs, outDir: output ?? "." }));
    return;
  }

  // Single .dlt file: output defaults to the input with a .html extension.
  const input = inputs[0];
  const result = compileFile(input);
  for (const d of result.diagnostics) report(d);
  if (result.html === undefined) process.exit(1);

  const outPath = output ?? input.replace(/\.dlt$/, "") + ".html";
  writeFileSync(outPath, result.html);
  console.error(`${input} → ${outPath}`);
}

main();
