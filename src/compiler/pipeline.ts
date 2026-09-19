import { basename, dirname } from "node:path";
import type { ElementNode } from "./ast";
import type { ProjectConfig } from "./config";
import {
  error,
  hasErrors,
  warn,
  type CompileContext,
  type LabelEntry,
  type ReviewItem,
  type TeamMember,
} from "./context";
import { readUserFile } from "./files";
import { preprocess } from "./preprocess";
import { parse } from "./parse";
import { resolveIncludes } from "./include";
import { applyDocumentDefaults } from "./document";
import { describeFinal, finalizeReview, sumFinal, type FinalStats } from "./final";
import { collectTeam } from "./team";
import { expandAnimated } from "./animated";
import { expandCover } from "./cover";
import { resolveCollab } from "./collab";
import { fillProjectBibliography, loadBibliography, numberCitations } from "./bibliography";
import { freshNumbering, numberDocument, type NumberingState } from "./numbering";
import { annotateCrossFileCites, annotateCrossFileRefs, buildIdMaps } from "./crossfile";
import { renderMath } from "./math";
import { highlightCode } from "./code";
import { buildProjectToc } from "./toc";
import { buildProjectReview } from "./review";
import { resolveReferences } from "./references";
import { inlineFigures } from "./figures";
import { resolveTheme } from "./theme";
import { resolveImports, resolvePack } from "./imports";
import { resolveLineBreaks } from "./linebreaks";
import { emit } from "./emit";

/**
 * THE pipeline, declared as data. Every compilation — one `.dlt` or a whole project — is a list
 * of files sharing one `Shared` state, run through the phases below by `runPipeline`. A single
 * file is simply a project of one file.
 *
 * Read the `PIPELINE` table top to bottom: that order *is* the architecture. Each step is either
 * `each` (runs once per file, in input order, before the next step starts on any file) or `all`
 * (runs once, project-wide). Passes communicate only through node attrs, the file's
 * `CompileContext` and the `Shared` maps every context points at.
 */

/** One input file on its way from source text to HTML. */
export interface FileUnit {
  ctx: CompileContext;
  /** Output basename, `chapter1.html` (also written to `ctx.outName`). */
  outName: string;
  /** Pre-filled by `compileSource`; otherwise the `readSource` step reads `ctx.file`. */
  source?: string;
  /** `null` until `parse`; a failed read or parse leaves it null and trips the bail after phase `load`. */
  doc: ElementNode | null;
  /** Set by `emit`. */
  html?: string;
}

/** State shared by every file of one compilation. Every `ctx` points at the same four maps. */
export interface Shared {
  registry: Map<string, LabelEntry>;
  papers: Map<string, ElementNode>;
  citedPapers: string[];
  team: Map<string, TeamMember>;
  /** Counters continue file to file, so chapter 2 numbers after chapter 1. */
  numbering: NumberingState;
  /** id → node, project-wide; emit snapshots cross-file pop-over targets from it. */
  globalById: Map<string, ElementNode>;
  /** id → home output name; cross-file links are built from it. */
  idToFile: Map<string, string>;
  /** The output that renders the references list, once `fillProjectBibliography` chose it. */
  bibOut?: string;
  finalStats: FinalStats[];
  /** Every collaboration item, tagged with its home output (`delta review` prints this). */
  reviewItems: ReviewItem[];
  /** The project's own context: `project.toml` packages land on its `imports`, project-level
   *  diagnostics (duplicate outputs, the --final summary) on its `diagnostics`. */
  project: CompileContext;
  /** Absent for `compileSource`/`compileFile`. */
  config?: ProjectConfig;
  final: boolean;
}

export interface Step {
  /** The function it calls, so `grep` finds it. */
  name: string;
  /** One line for the docs. */
  what: string;
  /** Per file, in input order. */
  each?: (file: FileUnit, shared: Shared) => void;
  /** Once, project-wide. */
  all?: (files: FileUnit[], shared: Shared) => void;
}

export interface Phase {
  name: string;
  what: string;
  steps: Step[];
  /** Stop after this phase if any context has an error. */
  bail?: boolean;
}

/** What `CompileOptions.trace` receives: after every file of an `each` step (with `file`), and after every step. */
export interface TraceEvent {
  phase: string;
  step: string;
  /** The output name of the file just processed; absent on the step-complete event. */
  file?: string;
  files: FileUnit[];
  shared: Shared;
}

/** Per-build switches (the CLI flags), shared by every entry point. */
export interface CompileOptions {
  /** Strip every collaboration mark (comments, tasks, changes, status, team) — the clean publication. */
  final?: boolean;
  /** Observe the pipeline step by step (the docs' pipeline explorer is built from this). */
  trace?: (event: TraceEvent) => void;
}

type Pass = (doc: ElementNode, ctx: CompileContext, shared: Shared, file: FileUnit) => void;

/** Adapts an ordinary `(doc, ctx)` pass into a per-file step; a file with no doc is skipped. */
function perFile(pass: Pass): Step["each"] {
  return (f, s) => {
    if (f.doc) pass(f.doc, f.ctx, s, f);
  };
}

type Parsed = { ctx: CompileContext; doc: ElementNode; outName: string };

/** The files that have a tree — all of them once phase `load` has passed. */
function parsed(files: FileUnit[]): Parsed[] {
  return files.filter((f): f is FileUnit & { doc: ElementNode } => f.doc !== null);
}

export const PIPELINE: Phase[] = [
  {
    name: "load",
    what: "Read every input and turn each into one merged tree.",
    bail: true,
    steps: [
      {
        name: "resolvePackages",
        what: "project.toml `packages` → the project's imports, inlined into every output.",
        all: (_files, s) => {
          const config = s.config;
          if (!config?.packages?.length) return;
          const base = config.root ?? dirname(config.inputs[0] ?? config.outDir);
          const seen = new Set<string>();
          for (const spec of config.packages) resolvePack(spec, base, s.project, seen);
        },
      },
      {
        name: "readSource",
        what: "Read the .dlt from disk (unless the caller handed over the text) and record it for --watch.",
        each: (f) => {
          if (f.source !== undefined) return;
          try {
            f.source = readUserFile(f.ctx, f.ctx.file);
          } catch (e) {
            error(f.ctx, e instanceof Error ? e.message : String(e));
          }
        },
      },
      {
        name: "parse",
        what: "preprocess (escape < > & inside math and raw tags), then strict XML → the generic AST.",
        each: (f) => {
          if (f.source !== undefined) f.doc = parse(preprocess(f.source), f.ctx);
        },
      },
      {
        name: "resolveIncludes",
        what: "Splice <include> files into the tree (recursive, cycle detection; a missing file is an error).",
        each: perFile(resolveIncludes),
      },
      {
        name: "applyDocumentDefaults",
        what: "Fill project.toml [document] defaults onto <document>, then read `lang` into ctx.lang.",
        each: perFile((doc, ctx, s) => applyDocumentDefaults(doc, ctx, s.config?.document)),
      },
      {
        name: "finalizeReview",
        what: "--final only: strip comments/tasks/team, accept changes. Before numbering, so nothing stripped consumes a counter.",
        each: perFile((doc, ctx, s) => {
          s.finalStats.push(finalizeReview(doc, ctx, false));
        }),
      },
      {
        name: "collectTeam",
        what: "<team> → the shared team map; the node is removed (the data ships in the review island).",
        each: perFile(collectTeam),
      },
      {
        name: "expandAnimated",
        what: "Presentations only: animated=\"true\" → reveal=\"true\" on each child element.",
        each: perFile(expandAnimated),
      },
      {
        name: "expandCover",
        what: "Presentations only: <cover> → <slide cover=\"true\">.",
        each: perFile(expandCover),
      },
    ],
  },
  {
    name: "collab",
    what: "Validate the collaboration vocabulary, now that every file's team is known.",
    steps: [
      {
        name: "resolveCollab",
        what: "comment/todo/change/status vocabulary: write defaults, warn on unknown values, check by/for against the team.",
        each: perFile(resolveCollab),
      },
      {
        name: "summarizeFinal",
        what: "--final only: one warning with what the final build left behind (open comments, tasks, unverified blocks).",
        all: (_files, s) => {
          if (!s.final) return;
          const msg = describeFinal(sumFinal(s.finalStats));
          if (msg) warn(s.project, msg);
        },
      },
    ],
  },
  {
    name: "bibliography",
    what: "Load the paper database and number citations project-wide, before numbering, so the cited <paper> nodes flow through the later passes.",
    steps: [
      {
        name: "loadBibliography",
        what: "<paper> children and the .ref file → the shared papers map; the <bibliography> is emptied (its <title> kept).",
        each: perFile(loadBibliography),
      },
      {
        name: "numberCitations",
        what: "<cite> numbered by first appearance across files (data-cite-nums); cited ids join referencedIds.",
        each: perFile(numberCitations),
      },
      {
        name: "fillProjectBibliography",
        what: "The first <bibliography> (input order) receives the cited papers; extras warn and stay empty.",
        all: (files, s) => {
          s.bibOut = fillProjectBibliography(parsed(files));
        },
      },
    ],
  },
  {
    name: "numbering",
    what: "Assign LaTeX-style numbers from the environments table; one counter state runs through the files in order.",
    steps: [
      {
        name: "numberDocument",
        what: "Write attrs.num on every numbered tag and register every id in the shared registry.",
        each: perFile((doc, ctx, s) => {
          numberDocument(doc, ctx, s.numbering);
        }),
      },
      {
        name: "buildIdMaps",
        what: "id → node (pop-over snapshots) and id → home output (cross-file links), project-wide. No later step may replace an element node.",
        all: (files, s) => buildIdMaps(parsed(files), s.globalById, s.idToFile),
      },
    ],
  },
  {
    name: "render",
    what: "Resolve everything that needs the registry, and inline every asset.",
    steps: [
      {
        name: "renderMath",
        what: "$…$ and math tags → KaTeX HTML (RawNode); \\ref{} inside math resolves against the registry. Sets mathUsed.",
        each: perFile((doc, ctx, s) => renderMath(doc, ctx, s.idToFile)),
      },
      {
        name: "highlightCode",
        what: "<code lang> → highlighted HTML (RawNode); after math, which skips the code raw-tag.",
        each: perFile(highlightCode),
      },
      {
        name: "buildProjectToc",
        what: "Heading tree → ctx.toc (auto-slug ids for headings without one); book-wide when a <toc scope=\"project\"> exists.",
        all: (files) => buildProjectToc(parsed(files)),
      },
      {
        name: "buildProjectReview",
        what: "Comments, tasks, changes and status blocks → ctx.review (+ their nearest heading); project-wide when asked.",
        all: (files, s) => {
          s.reviewItems = buildProjectReview(parsed(files));
        },
      },
      {
        name: "resolveReferences",
        what: "<ref to>/<solution of>/<proof of> → data-target-num + data-target-tag from the registry; targets join referencedIds.",
        each: perFile(resolveReferences),
      },
      {
        name: "annotateCrossFileRefs",
        what: "A resolved ref whose target lives in another output gets data-target-href=\"file#id\".",
        each: perFile((doc, _ctx, s, f) => annotateCrossFileRefs(doc, f.outName, s.idToFile)),
      },
      {
        name: "annotateCrossFileCites",
        what: "A resolved <cite> in a file other than the one rendering the references list gets data-cite-file.",
        each: perFile((doc, _ctx, s, f) => {
          if (s.bibOut && s.bibOut !== f.outName) annotateCrossFileCites(doc, s.bibOut);
        }),
      },
      {
        name: "inlineFigures",
        what: "<figure src> images → data: URIs (the output must work offline).",
        each: perFile(inlineFigures),
      },
      {
        name: "resolveTheme",
        what: "<document theme / theme-accent / theme-mode> → ctx.userCss / builtinCss / themeAccent / themeMode.",
        each: perFile(resolveTheme),
      },
      {
        name: "resolveImports",
        what: "Project packages first, then this file's <import> packs → ctx.imports (JS after the runtime, CSS before the author theme).",
        each: perFile((doc, ctx, s) => {
          ctx.imports.push(...s.project.imports);
          resolveImports(doc, ctx);
        }),
      },
      {
        name: "resolveLineBreaks",
        what: "A blank line in prose becomes a line break (<br><br>). Last, so every other pass sees the original text nodes.",
        each: perFile(resolveLineBreaks),
      },
    ],
  },
  {
    name: "emit",
    what: "Serialize each tree into one standalone HTML file.",
    steps: [
      {
        name: "emit",
        what: "Rename tags to <delta-*>, inline CSS/runtime/packs, snapshot referenced targets, ship the JSON islands.",
        each: perFile((doc, ctx, s, f) => {
          f.html = emit(doc, ctx, s.globalById);
        }),
      },
    ],
  },
];

/**
 * Runs the pipeline over `files`. Every file's context is pointed at the shared maps first;
 * then each phase's steps run in order (an `each` step over every file before the next step
 * starts). Returns false when a bailing phase ended with an error in any context — the
 * caller then produces no output.
 */
export function runPipeline(files: FileUnit[], shared: Shared, options: CompileOptions = {}): boolean {
  const trace = options.trace;
  for (const f of files) {
    f.ctx.registry = shared.registry;
    f.ctx.papers = shared.papers;
    f.ctx.citedPapers = shared.citedPapers;
    f.ctx.team = shared.team;
    f.ctx.final = shared.final;
    f.ctx.outName = f.outName;
  }
  for (const phase of PIPELINE) {
    for (const step of phase.steps) {
      if (step.each) {
        for (const f of files) {
          step.each(f, shared);
          trace?.({ phase: phase.name, step: step.name, file: f.outName, files, shared });
        }
      } else {
        step.all?.(files, shared);
      }
      trace?.({ phase: phase.name, step: step.name, files, shared });
    }
    if (phase.bail && (hasErrors(shared.project) || files.some((f) => hasErrors(f.ctx)))) return false;
  }
  return true;
}

/** A fresh shared state; `init` overrides any field (a single file lends its own maps). */
export function createShared(init: Partial<Shared> & { project: CompileContext }): Shared {
  return {
    registry: new Map(),
    papers: new Map(),
    citedPapers: [],
    team: new Map(),
    numbering: freshNumbering(),
    globalById: new Map(),
    idToFile: new Map(),
    finalStats: [],
    reviewItems: [],
    final: false,
    ...init,
  };
}

/** Flat output name for an input: `chapters/01.dlt` → `01.html`. */
export function outNameFor(input: string): string {
  return basename(input).replace(/\.dlt$/, "") + ".html";
}
