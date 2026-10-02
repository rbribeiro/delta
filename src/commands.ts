import { type FSWatcher, existsSync, mkdirSync, readdirSync, watch, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parseArgs, type ParseArgsConfig } from "node:util";
import { compileFile, type CompileOptions } from "./compiler/index";
import { loadProjectConfig } from "./compiler/config";
import { compileProject } from "./compiler/project";
import type { Diagnostic, ReviewData } from "./compiler/context";
import type { ProofGraph } from "./compiler/graph";
import { scaffoldFiles } from "./scaffold";
import { installPackages } from "./install";
import { filterReview, formatReviewText, reviewJson } from "./review-report";
import { verify } from "./verify";
import { AGENT_GUIDE } from "./agent-guide";
import {
  frontierJson,
  frontierText,
  graphJson,
  graphText,
  lintFindings,
  lintText,
  outlineJson,
  outlineText,
  showData,
  showJson,
  showText,
  usesJson,
  usesText,
  type Rel,
} from "./graph-report";

/**
 * The `delta` commands. `main(argv)` runs one and returns its exit code; src/cli.ts is the
 * executable that calls it, and the tests call it in-process. Output goes through `io`
 * (stdout for results, stderr for diagnostics and progress), so a test can capture it.
 *
 * Every command has the same shape: parse its arguments (`parse`), find its inputs
 * (`resolveInputs`: a project.toml, several .dlt, or one), compile them (`compileInputs`,
 * stopping as early as the command allows), then print or write. `--help`/`-h` prints the
 * banner on stdout and exits 0; every usage error prints it on stderr and exits 1.
 */

// The version is read from package.json at runtime, so it is never out of sync. `../package.json`
// resolves from src/ (tsx), from dist/cli.js (the esbuild bundle) and from the installed
// layout (node_modules/delta-lang/dist/cli.js): npm ships the root package.json alongside dist/.
const require = createRequire(import.meta.url);
const VERSION: string = require("../package.json").version;

const HELP = [
  "usage: delta build <file.dlt> [-o out.html] [--watch] [--final]",
  "       delta build <a.dlt> <b.dlt> ... [-o out-dir] [--watch] [--final]   # multi-file project",
  "       delta build [project.toml] [-o out-dir] [--watch] [--final]        # project file",
  "       delta review [input] [--json] [--status s] [--for id] [--by id] [--kind k]",
  "       delta outline [input] [--json]                           # sections and results, with status",
  "       delta show <id> [input] [--context] [--json]             # one result's source (+ its parents' statements)",
  "       delta uses <id> [input] [--json]                         # everything downstream of a result",
  "       delta graph [input] [--frontier] [--json]                # the proof graph (or the work available now)",
  "       delta lint [input] [--json]                              # cycles, dangling refs, stale and overclaimed results",
  "       delta verify <id> [input] [--by name] [--json]           # sign a result's proof as verified, pinned to a hash",
  "       delta agent-guide                                        # how an agent works on a proof here",
  "       delta create <project|package> <name>                    # scaffold a project/package",
  "       delta install <pkg> [<pkg>...] [--project <file>]        # npm install + add to project.toml",
  "       delta --version | -v                                     # print the version",
  "       delta --help | -h                                        # print this help",
  "  --final  strips every collaboration mark (comments, tasks, changes, status, team): the clean publication",
  "  input    a .dlt, several .dlt, or a project.toml; defaults to ./project.toml",
].join("\n");

/** Where a command writes: results to `out` (stdout), diagnostics and progress to `err` (stderr). */
export interface Io {
  out(text: string): void;
  err(text: string): void;
}

const PROCESS_IO: Io = {
  out: (text) => process.stdout.write(text),
  err: (text) => process.stderr.write(text),
};

let io: Io = PROCESS_IO;

/** Runs `delta <argv>` and returns the exit code. `--watch` returns 0 and keeps watching. */
export function main(argv: string[], streams: Io = PROCESS_IO): number {
  io = streams;
  try {
    const [command, ...args] = argv;
    if (command === "--help" || command === "-h") help();
    if (command === "--version" || command === "-v") {
      io.out(`${VERSION}\n`); // the bare number, script-friendly
      return 0;
    }
    const run = COMMANDS[command ?? ""];
    if (!run) usage();
    return run(args);
  } catch (e) {
    if (e instanceof Exit) return e.code;
    throw e;
  }
}

const COMMANDS: Record<string, (args: string[]) => number> = {
  build: buildMain,
  review: reviewMain,
  outline: outlineMain,
  show: showMain,
  uses: usesMain,
  graph: graphMain,
  lint: lintMain,
  verify: verifyMain,
  "agent-guide": agentGuideMain,
  create: createMain,
  install: installMain,
};

// -- shared plumbing ------------------------------------------------------------------

/** Thrown to end a command early with an exit code; `main` turns it into its return value. */
class Exit extends Error {
  constructor(readonly code: number) {
    super(`exit ${code}`);
  }
}

/** A usage error: the banner on stderr, exit 1. */
function usage(): never {
  io.err(`${HELP}\n`);
  throw new Exit(1);
}

/** `--help` / `-h`: the banner on stdout, exit 0. */
function help(): never {
  io.out(`${HELP}\n`);
  throw new Exit(0);
}

/** `error: <message>` on stderr, exit 1. */
function fail(message: string): never {
  io.err(`error: ${message}\n`);
  throw new Exit(1);
}

type Options = NonNullable<ParseArgsConfig["options"]>;

/**
 * A command's arguments, parsed by `node:util.parseArgs`: an unknown flag or a flag missing
 * its value is a usage error, and `--help`/`-h` is accepted by every command.
 */
function parse<const O extends Options>(args: string[], options: O) {
  const config = {
    args,
    options: { ...options, help: { type: "boolean", short: "h" } } as const,
    allowPositionals: true,
    strict: true,
  } as const;
  let parsed: ReturnType<typeof parseArgs<typeof config>>;
  try {
    parsed = parseArgs(config);
  } catch {
    usage();
  }
  if ((parsed.values as { help?: boolean }).help) help();
  return parsed;
}

function report(d: Diagnostic): void {
  const where = d.pos ? `${d.file}:${d.pos.line}:${d.pos.column}` : d.file;
  io.err(`${d.severity}: ${d.message} (${where})\n`);
}

function hasError(diags: Diagnostic[]): boolean {
  return diags.some((d) => d.severity === "error");
}

/** What to compile: a project file, or `.dlt` files (several compile as one project). */
type Inputs = { projectFile: string } | { files: string[] };

/**
 * The inputs every command takes the same way: `--project <file>`, a single positional
 * `.toml`, one or more `.dlt`, or nothing (then `./project.toml`, which must exist).
 */
function resolveInputs(positionals: string[], projectFlag?: string): Inputs {
  if (projectFlag !== undefined) {
    if (positionals.length) usage(); // `--project` and positional inputs together: ambiguous
    return { projectFile: projectFlag };
  }
  if (positionals.length === 1 && positionals[0].endsWith(".toml")) return { projectFile: positionals[0] };
  if (positionals.length > 0) return { files: positionals };
  if (!existsSync("project.toml")) usage();
  return { projectFile: "project.toml" };
}

/** Everything a command may need from a compile; `outputs` is empty when it stopped early or failed. */
interface Compiled {
  diagnostics: Diagnostic[];
  /** Absolute paths of every user file read, the entry files included (for `--watch`). */
  deps: string[];
  outputs: { path: string; html: string; from?: string }[];
  review?: ReviewData;
  graph?: ProofGraph;
}

/**
 * Compiles the inputs and collects the results; writes nothing. `output` is `-o`: the
 * output file of a single `.dlt`, or the output directory of a project (overriding the
 * toml's `out`).
 */
function compileInputs(inputs: Inputs, options: CompileOptions, output?: string): Compiled {
  const entry = ("projectFile" in inputs ? [inputs.projectFile] : inputs.files).map((p) => resolve(p));
  const withEntry = (deps: string[]): string[] => [...new Set([...entry, ...deps])];

  if ("projectFile" in inputs) {
    const { config, diagnostics } = loadProjectConfig(inputs.projectFile);
    if (!config) return { diagnostics, deps: entry, outputs: [] };
    if (output) config.outDir = resolve(output);
    const result = compileProject(config, options);
    return { ...result, diagnostics: [...diagnostics, ...result.diagnostics], deps: withEntry(result.deps) };
  }
  if (inputs.files.length > 1) {
    const result = compileProject({ inputs: inputs.files, outDir: output ?? "." }, options);
    return { ...result, deps: withEntry(result.deps) };
  }
  const [input] = inputs.files;
  const result = compileFile(input, options);
  const path = output ?? input.replace(/\.dlt$/, "") + ".html";
  return {
    ...result,
    deps: withEntry(result.deps),
    outputs: result.html === undefined ? [] : [{ path, html: result.html, from: input }],
  };
}

const rel: Rel = (file) => relative(process.cwd(), resolve(file)) || file;

function print(json: boolean, data: () => unknown, text: () => string): void {
  io.out(json ? JSON.stringify(data(), null, 2) + "\n" : text());
}

// -- build ----------------------------------------------------------------------------

/** `delta build …` — compile and write (single file / multi-file / project), or keep watching. */
function buildMain(args: string[]): number {
  const { values, positionals } = parse(args, {
    output: { type: "string", short: "o" },
    project: { type: "string" },
    watch: { type: "boolean", short: "w" },
    final: { type: "boolean" },
  });
  const inputs = resolveInputs(positionals, values.project);
  const build = (): Compiled => {
    const result = compileInputs(inputs, { final: values.final ?? false }, values.output);
    for (const d of result.diagnostics) report(d);
    if (hasError(result.diagnostics)) return result;
    for (const o of result.outputs) {
      mkdirSync(dirname(o.path), { recursive: true }); // `-o dir/that/does/not/exist.html` is fine
      writeFileSync(o.path, o.html);
      io.err(o.from ? `${o.from} → ${o.path}\n` : `→ ${o.path}\n`);
    }
    return result;
  };
  if (values.watch) {
    watchAndRebuild(() => build().deps);
    return 0;
  }
  return hasError(build().diagnostics) ? 1 : 0;
}

/**
 * Builds once, then watches every dependency and rebuilds on change. Keeps running
 * through compile errors so the author can fix and see it recover. Watches the
 * directories containing the deps and filters events to the dep basenames, which is
 * robust to editors' atomic save-as-rename and means writing the output file (not a
 * source dep) never triggers a rebuild loop.
 *
 * The watchers stay open across builds, so a save that lands while a build runs is
 * queued and triggers the next one. They are recreated only when the dep set changed
 * (an `<include>` added or removed, a figure renamed).
 */
function watchAndRebuild(build: () => string[]): void {
  let watchers: FSWatcher[] = [];
  let watched = "";
  let timer: NodeJS.Timeout | undefined;

  const trigger = (): void => {
    clearTimeout(timer);
    timer = setTimeout(rebuild, 80); // debounce the burst editors emit per save
  };

  const watchDeps = (deps: string[]): void => {
    const key = [...deps].sort().join("\n");
    if (key === watched) return;
    watched = key;
    for (const w of watchers) w.close();
    watchers = [];

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
    io.err(`watching ${deps.length} files… (Ctrl-C to stop)\n`);
  };

  function rebuild(): void {
    watchDeps(build());
  }

  rebuild(); // initial build + watch
}

// -- review ---------------------------------------------------------------------------

/**
 * `delta review [input] [--json] [--status s] [--for id] [--by id] [--kind k]` —
 * prints the paper's collaboration state (comments, tasks, changes, status blocks) as text or
 * JSON on stdout; diagnostics go to stderr. The agent-facing view: no browser needed.
 */
function reviewMain(args: string[]): number {
  const { values, positionals } = parse(args, {
    json: { type: "boolean" },
    status: { type: "string" },
    for: { type: "string" },
    by: { type: "string" },
    kind: { type: "string" },
  });
  const { diagnostics, review } = compileInputs(resolveInputs(positionals), { stopAfter: "buildProjectReview" });
  for (const d of diagnostics) report(d);
  if (!review || hasError(diagnostics)) return 1;

  const items = filterReview(review.items, values);
  print(values.json ?? false, () => reviewJson(review, items), () => formatReviewText(review, items));
  return 0;
}

// -- the proof-graph commands ---------------------------------------------------------

/**
 * The arguments of a graph command: its flags, the ids it names and the inputs. A positional
 * ending in `.dlt` or `.toml` is an input, anything else an id, so either order works
 * (`delta show thm p.dlt`, `delta show p.dlt thm`).
 */
function graphArgs<const O extends Options>(args: string[], options: O, ids: number) {
  const { values, positionals } = parse(args, { ...options, json: { type: "boolean" } });
  const isInput = (p: string) => p.endsWith(".dlt") || p.endsWith(".toml");
  const named = positionals.filter((p) => !isInput(p));
  if (named.length !== ids) usage();
  return { values, ids: named, inputs: resolveInputs(positionals.filter(isInput)) };
}

/**
 * The proof graph of the inputs, with every diagnostic, compiled only as far as the graph
 * (no math, no HTML) unless `through` asks for more. A document with errors still has a
 * graph (only a file that fails to load has none), so an agent can navigate a broken proof
 * and `lint` can report what broke.
 */
function loadGraph(inputs: Inputs, through = "buildGraph"): { graph: ProofGraph; diagnostics: Diagnostic[] } {
  const { graph, diagnostics } = compileInputs(inputs, { stopAfter: through });
  if (!graph) {
    for (const d of diagnostics) report(d);
    throw new Exit(1);
  }
  return { graph, diagnostics };
}

/** `delta outline [input] [--json]` — sections and results, each with own/effective status and file:line. */
function outlineMain(args: string[]): number {
  const a = graphArgs(args, {}, 0);
  const { graph } = loadGraph(a.inputs);
  print(a.values.json ?? false, () => outlineJson(graph, rel), () => outlineText(graph, rel));
  return 0;
}

/** `delta show <id> [input] [--context] [--json]` — a node's source; with --context, its parents' statements too. */
function showMain(args: string[]): number {
  const a = graphArgs(args, { context: { type: "boolean" } }, 1);
  const [id] = a.ids;
  const { graph } = loadGraph(a.inputs);
  const data = showData(graph, id, rel, a.values.context ?? false);
  if (!data) fail(`no element with id "${id}"`);
  print(a.values.json ?? false, () => showJson(data, rel), () => showText(data));
  return 0;
}

/** `delta uses <id> [input] [--json]` — everything downstream of a result. */
function usesMain(args: string[]): number {
  const a = graphArgs(args, {}, 1);
  const [id] = a.ids;
  const { graph } = loadGraph(a.inputs);
  if (!graph.nodes.has(id)) fail(`no element with id "${id}"`);
  print(a.values.json ?? false, () => usesJson(graph, id, rel), () => usesText(graph, id, rel));
  return 0;
}

/** `delta graph [input] [--frontier] [--json]` — the whole graph, or just the work available now. */
function graphMain(args: string[]): number {
  const a = graphArgs(args, { frontier: { type: "boolean" } }, 0);
  const { graph } = loadGraph(a.inputs);
  const json = a.values.json ?? false;
  if (a.values.frontier) print(json, () => frontierJson(graph, rel), () => frontierText(graph, rel));
  else print(json, () => graphJson(graph, rel), () => graphText(graph, rel));
  return 0;
}

/**
 * `delta lint [input] [--json]` — structural problems plus every compile diagnostic; exit 1
 * when any is an error. Compiles through the render phase (math, refs, assets) so nothing
 * an author would see in `build` is missed, but writes no HTML.
 */
function lintMain(args: string[]): number {
  const a = graphArgs(args, {}, 0);
  const { graph, diagnostics } = loadGraph(a.inputs, "render");
  const findings = lintFindings(graph, diagnostics, rel);
  print(a.values.json ?? false, () => ({ findings }), () => lintText(findings));
  return findings.some((f) => f.severity === "error") ? 1 : 0;
}

/** `delta verify <id> [input] [--by name] [--json]` — sign a result's proof (see verify.ts). */
function verifyMain(args: string[]): number {
  const a = graphArgs(args, { by: { type: "string" } }, 1);
  const { graph } = loadGraph(a.inputs);
  const v = verify(graph, a.ids[0], a.values.by);
  if ("error" in v) fail(v.error);
  for (const w of v.warnings) io.err(`warning: ${w}\n`);
  print(
    a.values.json ?? false,
    () => ({ ...v, file: rel(v.file) }),
    () => `verified ${v.id} against ${v.against}${v.verifiedBy ? ` by ${v.verifiedBy}` : ""} (${rel(v.file)}:${v.line})\n`,
  );
  return 0;
}

// -- the rest -------------------------------------------------------------------------

/** `delta agent-guide` — how an agent works on a proof here. */
function agentGuideMain(args: string[]): number {
  if (parse(args, {}).positionals.length) usage();
  io.out(AGENT_GUIDE);
  return 0;
}

/** `delta create <project|package> <name>` — scaffold a starter directory (never clobbers). */
function createMain(args: string[]): number {
  const [kind, name, ...extra] = parse(args, {}).positionals;
  if ((kind !== "project" && kind !== "package") || !name || extra.length) {
    io.err("usage: delta create <project|package> <name>\n");
    return 1;
  }

  const target = resolve(name);
  if (existsSync(target) && readdirSync(target).length > 0) fail(`${target} already exists and is not empty`);

  for (const [path, content] of Object.entries(scaffoldFiles(kind, basename(target)))) {
    const file = join(target, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
  }

  io.err(`created ${kind} in ${target}\n`);
  io.err(
    kind === "project"
      ? `next: cd ${name} && delta build project.toml\n`
      : `next: cd ${name} && npm install && npm run build\n`,
  );
  return 0;
}

/** `delta install <pkg>… [--project <file>]` — npm install + record in project.toml. */
function installMain(args: string[]): number {
  const { values, positionals } = parse(args, { project: { type: "string" } });
  if (positionals.length === 0) {
    io.err("usage: delta install <pkg> [<pkg>...] [--project <file>]\n");
    return 1;
  }
  return installPackages(positionals, { projectFile: values.project }) ? 0 : 1;
}
