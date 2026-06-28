#!/usr/bin/env node
import { type FSWatcher, mkdirSync, watch, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { compileFile } from "./compiler/index";
import { loadProjectConfig } from "./compiler/config";
import { compileProject, type ProjectResult } from "./compiler/project";
import type { Diagnostic } from "./compiler/context";

/** The CLI source entry point.
 * It parses command-line arguments, loads a project config if requested, and calls the compiler. It reports diagnostics and writes outputs to disk. It exits with a non-zero code if there were any errors, unless `--watch` is set (then it keeps running and rebuilds on change).
 */

function usage(): never {
  console.error("usage: delta build <file.dlt> [-o out.html] [--watch]");
  console.error("       delta build <a.dlt> <b.dlt> ... [-o out-dir] [--watch]   # multi-file project");
  console.error("       delta build <project.toml> [-o out-dir] [--watch]        # project file");
  process.exit(1);
}

function report(d: Diagnostic): void {
  const where = d.pos ? `${d.file}:${d.pos.line}:${d.pos.column}` : d.file;
  console.error(`${d.severity}: ${d.message} (${where})`);
}

function hasError(diags: Diagnostic[]): boolean {
  return diags.some((d) => d.severity === "error");
}

interface BuildOptions {
  projectFile?: string;
  inputs: string[];
  output?: string;
}

/** Outcome of one build pass: whether it succeeded and which user files it read. */
interface BuildOutcome {
  ok: boolean;
  deps: string[];
}

/** Report a project's diagnostics and, if it succeeded, write every output. */
function writeProject(result: ProjectResult): boolean {
  for (const d of result.diagnostics) report(d);
  if (hasError(result.diagnostics)) return false;
  for (const o of result.outputs) {
    mkdirSync(dirname(o.path), { recursive: true });
    writeFileSync(o.path, o.html);
    console.error(`→ ${o.path}`);
  }
  return true;
}

/**
 * Run a single build (project / multi-file / single), report diagnostics and write
 * outputs. Never exits the process — returns success plus the set of user files the
 * compile read, so the caller decides what to do (exit code, or set up watchers).
 * The entry inputs / project file are always included in `deps` so a failed compile
 * still watches the right files for the next save.
 */
function buildOnce(opts: BuildOptions): BuildOutcome {
  const { projectFile, inputs, output } = opts;
  // Files we always want to watch even if the compile fails before recording them.
  const entry = [...inputs, ...(projectFile ? [projectFile] : [])].map((p) => resolve(p));

  if (projectFile) {
    const { config, diagnostics } = loadProjectConfig(projectFile);
    for (const d of diagnostics) report(d);
    if (!config) return { ok: false, deps: entry };
    if (output) config.outDir = resolve(output); // -o overrides the toml's `out`
    const result = compileProject(config);
    const ok = writeProject(result);
    return { ok, deps: [...new Set([...entry, ...result.deps])] };
  }

  // Several .dlt inputs compile as one project (shared numbering, cross-file refs).
  if (inputs.length > 1) {
    const result = compileProject({ inputs, outDir: output ?? "." });
    const ok = writeProject(result);
    return { ok, deps: [...new Set([...entry, ...result.deps])] };
  }

  // Single .dlt file: output defaults to the input with a .html extension.
  const input = inputs[0];
  const result = compileFile(input);
  for (const d of result.diagnostics) report(d);
  const deps = [...new Set([...entry, ...result.deps])];
  if (result.html === undefined) return { ok: false, deps };

  const outPath = output ?? input.replace(/\.dlt$/, "") + ".html";
  writeFileSync(outPath, result.html);
  console.error(`${input} → ${outPath}`);
  return { ok: true, deps };
}

/**
 * Build once, then watch every dependency and rebuild on change. Keeps running
 * through compile errors so the author can fix and see it recover. Watches the
 * directories containing the deps and filters events to the dep basenames, which is
 * robust to editors' atomic save-as-rename and means writing the output file (not a
 * source dep) never triggers a rebuild loop.
 */
function runWatch(opts: BuildOptions): void {
  let watchers: FSWatcher[] = [];
  let timer: NodeJS.Timeout | undefined;
  let building = false;
  let dirty = false;

  const closeWatchers = (): void => {
    for (const w of watchers) w.close();
    watchers = [];
  };

  const setupWatchers = (deps: string[]): void => {
    const byDir = new Map<string, Set<string>>();
    for (const f of deps) {
      const dir = dirname(f);
      let names = byDir.get(dir);
      if (!names) byDir.set(dir, (names = new Set()));
      names.add(basename(f));
    }
    for (const [dir, names] of byDir) {
      try {
        watchers.push(
          watch(dir, (_event, filename) => {
            if (filename && names.has(filename)) trigger();
          }),
        );
      } catch {
        // a missing/inaccessible directory just isn't watched
      }
    }
    console.error(`watching ${deps.length} files… (Ctrl-C to stop)`);
  };

  const rebuild = (): void => {
    building = true;
    dirty = false;
    closeWatchers();
    const { deps } = buildOnce(opts); // reports + writes; never exits in watch mode
    setupWatchers(deps);
    building = false;
    if (dirty) trigger(); // a change landed mid-build — go again
  };

  const trigger = (): void => {
    if (building) {
      dirty = true;
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(rebuild, 80); // debounce the burst editors emit per save
  };

  rebuild(); // initial build + watch
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.shift() !== "build" || args.length === 0) usage();

  let output: string | undefined;
  let projectFile: string | undefined;
  let watchMode = false;
  const inputs: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "-o" || arg === "--output") output = args[++i] ?? usage();
    else if (arg === "--project") projectFile = args[++i] ?? usage();
    else if (arg === "--watch" || arg === "-w") watchMode = true;
    else if (arg.startsWith("-")) usage();
    else inputs.push(arg);
  }

  // A project file: --project <f>, or a single positional .toml.
  if (!projectFile && inputs.length === 1 && inputs[0].endsWith(".toml")) projectFile = inputs[0];
  if (!projectFile && inputs.length === 0) usage();

  const opts: BuildOptions = { projectFile, inputs, output };
  if (watchMode) {
    runWatch(opts);
    return;
  }
  process.exit(buildOnce(opts).ok ? 0 : 1);
}

main();
