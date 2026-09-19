/******************************************************************************
 * The mutable context threaded through every pass and into the emitter. 
 * Passes communicate through it (and through node attrs). Nothing else is shared. 
**** ***********************/

import { resolve } from "node:path";
import type { ElementNode, Node, Position } from "./ast";

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  file: string;
  pos?: Position;
}

/** What the numbering pass recorded for an `id`; read by references and pop-overs. */
export interface LabelEntry {
  tag: string;
  num: string;
}

/** One heading in the table of contents; built by `buildToc`, shipped by emit. */
export interface TocEntry {
  /** 1 = chapter, 2 = section, 3 = subsection, 4 = subsubsection. */
  level: number;
  /** Anchor target (author-supplied or auto-generated slug). */
  id: string;
  /** Display number ("1.2"); may be "". */
  num: string;
  /** Inline title children, serialized by emit (keeps math/emphasis). */
  title: Node[];
  /**
   * Home output file ("chapter2.html") for a project-wide ToC entry that lives in
   * *another* output; omitted when the entry belongs to the file being emitted (so
   * the runtime treats it as same-page) and on single-file builds.
   */
  file?: string;
}

/** One resolved package (a `<import>` pack or a `project.toml` package); inlined by emit. */
export interface ImportEntry {
  /** Absolute path to the pack's entry script (the dedup key across all channels). */
  source: string;
  /** Entry-script contents, inlined verbatim into a `<script>` after the runtime. */
  js: string;
  /** Optional stylesheet contents, inlined into a `<style>` BEFORE the author theme. */
  css?: string;
  /** Display label for the emit "pack:" marker (pkg name or folder basename). */
  name?: string;
  /** Tags the pack declares it owns; reserved for future tag-gating, unused today. */
  tags?: string[];
}

/** One collaborator declared in `<team>`; the runtime colors/badges `by`/`for` chips from it. */
export interface TeamMember {
  id: string;
  name: string;
  kind: "human" | "agent";
  /** A base.css accent palette name (`blue`, `purple`, …), explicit or round-robin assigned. */
  color: string;
}

/** The nearest enclosing heading of a review item ("where is this?" in the panel / CLI). */
export interface ReviewHeading {
  level: number;
  num: string;
  id: string;
  /** Inline title children, serialized by emit (keeps math). */
  title: Node[];
}

/** A `<reply>` inside a `<comment>`. */
export interface ReviewReply {
  by?: string;
  date?: string;
  /** Plain-text rendering (math kept as `$…$`) for the CLI report and "copy as text". */
  text: string;
  /** Live child nodes, serialized by emit for the panel. */
  body: Node[];
}

/**
 * One collaboration item collected by `buildReview`: a `<comment>`, a `<todo>`, a
 * `<change>`, or any block carrying `status`/`by`/`verified-by` (incl. `<draft>`).
 * Shipped as the `#delta-review` island (panel) and printed by `delta review` (CLI).
 */
export interface ReviewItem {
  kind: "comment" | "todo" | "change" | "status";
  id: string;
  /** Source tag: `comment`/`todo`/`change`, or the block's own tag (`proof`, `section`, `draft`…). */
  tag: string;
  num?: string;
  status: string;
  by?: string;
  for?: string;
  verifiedBy?: string;
  date?: string;
  due?: string;
  priority?: string;
  changeKind?: "insert" | "delete" | "replace";
  note?: string;
  /** Anchor id (`on="…"`) when the item is attached to another element. */
  on?: string;
  /** Plain-text rendering (math kept as `$…$`). */
  text: string;
  /** Live child nodes (the comment/task text, the changed content, a block's title). */
  body: Node[];
  replies?: ReviewReply[];
  heading?: ReviewHeading;
  /** Home output ("chapter2.html") when the item lives in *another* output of a project. */
  file?: string;
}

/** What `compileFile`/`compileProject` hand the CLI for `delta review`: the team + every item. */
export interface ReviewData {
  team: TeamMember[];
  items: ReviewItem[];
}

export interface CompileContext {
  file: string;
  /** Output basename for this file (e.g. "chapter1.html"), set by the pipeline runner for every build. */
  outName?: string;
  diagnostics: Diagnostic[];
  /** id → numbering info; written by numbering, read by the reference pass. 
   * Uses Map that is more efficient than Record<string, LabelEntry> for large documents with many labels.
  */
  registry: Map<string, LabelEntry>;
  /** Target ids something in this file points at: a `<ref>`/`<solution of>`/`<proof of>` (references.ts),
   *  a `<cite>` (bibliography.ts) or a `\ref{}` inside math (math.ts). Emit snapshots each into a
   *  `<template>` so the runtime can show a pop-over without fetching. */
  referencedIds: Set<string>;
  /** Heading tree for the table of contents; built by `buildToc`, emit ships it as a JSON island. */
  toc: TocEntry[];
  /** Set by the math pass, and by emit when a snapshot, ToC title or review item carries math rendered
   *  in another file; gates inlining KaTeX CSS (~1 MB with embedded fonts). */
  mathUsed: boolean;
  /** Document `lang` (raw author value, default "en"); drives i18n and `<html lang>`. */
  lang: string;
  /** Author CSS from `<document theme>`, resolved by the theme pass; emit inlines it last. */
  userCss?: string;
  /** CSS of the *built-in* theme named by `<document theme="impatech">` (from
   *  BUILTIN_THEMES), resolved by the same pass. Kept apart from `userCss` because
   *  the two occupy different cascade slots: this one is layered (delta.builtin,
   *  early), the author's own file stays unlayered and last so it still wins. */
  builtinCss?: string;
  /** Custom imports from <import src='' /> */
  imports: ImportEntry[];
  /** id → `<paper>` node; filled by `loadBibliography` from inline + the `.ref` src. */
  papers: Map<string, ElementNode>;
  /** Cited paper ids in first-cite order; index+1 is the citation number. */
  citedPapers: string[];

  /** Collaborators from `<team>` (id → member); shared across a project like `registry`. */
  team: Map<string, TeamMember>;
  /** Collaboration items collected by `buildReview` (comments, tasks, changes, status blocks);
   *  emit ships them as the `#delta-review` island, the CLI prints them. */
  review: ReviewItem[];
  /** `--final`: strip every collaboration mark so the output is the clean publication. */
  final: boolean;

  themeAccent?: string;
  /** Color mode from `<document theme-mode>` (`dark` | `auto`); drives `data-mode` on
   *  `<html>` and the matching token override in base.css. Unset = the light default. */
  themeMode?: string;

  /** Absolute paths of every user file this compile read (entry, includes, theme,
   *  imports, bibliography, figures); the CLI's `--watch` watches exactly this set. */
  deps: Set<string>;
}

/** Context constructor */
export function createContext(file: string): CompileContext {
  return {
    file,
    diagnostics: [],
    registry: new Map(),
    referencedIds: new Set(),
    toc: [],
    mathUsed: false,
    lang: "en",
    imports: [],
    papers: new Map(),
    citedPapers: [],
    team: new Map(),
    review: [],
    final: false,
    deps: new Set(),
  };
}

/** Record a user file this compile read, as an absolute path (for `--watch`). */
export function addDep(ctx: CompileContext, p: string): void {
  ctx.deps.add(resolve(p));
}

export function error(ctx: CompileContext, message: string, pos?: Position): void {
  ctx.diagnostics.push({ severity: "error", message, file: ctx.file, pos });
}

export function warn(ctx: CompileContext, message: string, pos?: Position): void {
  ctx.diagnostics.push({ severity: "warning", message, file: ctx.file, pos });
}

export function hasErrors(ctx: CompileContext): boolean {
  return ctx.diagnostics.some((d) => d.severity === "error");
}
