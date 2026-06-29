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

/** One resolved `<import>` custom-element pack; contents are inlined by emit. */
export interface ImportEntry {
  /** Absolute path to the pack's `index.js`. */
  source: string;
  /** `index.js` contents, inlined verbatim into a `<script>` after the runtime. */
  js: string;
  /** Optional `theme.css` contents, inlined into a `<style>` BEFORE the author theme. */
  css?: string;
}

export interface CompileContext {
  file: string;
  /** Output basename for this file (e.g. "chapter1.html"); set only on the project path. */
  outName?: string;
  diagnostics: Diagnostic[];
  /** id → numbering info; written by numbering, read by the reference pass. 
   * Uses Map that is more efficient than Record<string, LabelEntry> for large documents with many labels.
  */
  registry: Map<string, LabelEntry>;
  /** Target ids that a `<ref>` (or other element that references another one) resolved to; emit snapshots each into a `<template>`. 
   * So custom elements can use them at runtime as, for instance, pop-overs.
  */
  referencedIds: Set<string>;
  /** Heading tree for the table of contents; built by `buildToc`, emit ships it as a JSON island. */
  toc: TocEntry[];
  /** Set by the math pass; gates inlining KaTeX CSS (~1 MB with embedded fonts). */
  mathUsed: boolean;
  /** Document `lang` (raw author value, default "en"); drives i18n and `<html lang>`. */
  lang: string;
  /** Author CSS from `<document theme>`, resolved by the theme pass; emit inlines it last. */
  userCss?: string;
  /** Custom imports from <import src='' /> */
  imports: ImportEntry[];
  /** id → `<paper>` node; filled by `loadBibliography` from inline + the `.ref` src. */
  papers: Map<string, ElementNode>;
  /** Cited paper ids in first-cite order; index+1 is the citation number. */
  citedPapers: string[];

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
