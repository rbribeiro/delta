# The Delta Compiler — A Field Guide

*A page-by-page reading of `src/compiler/`: the pipeline, the data structures, and every pass,
with the source reproduced and annotated so you can follow it on paper.*

---

## How to read this book

Delta is a compiler. It turns a `.dlt` file — strict XML with custom tags — into **one standalone
HTML file that runs offline from `file://`**. This book is about the *compiler half* of the project
(`src/compiler/`, ~1,080 lines across 16 files). The browser half (`src/runtime/`) and the asset
build (`scripts/build.ts`) are out of scope except where the output makes no sense without them; see
Appendix E for pointers.

Two companion documents already exist and are worth keeping nearby: [ARCHITECTURE.md](ARCHITECTURE.md)
(the concepts) and [CONTRIBUTING.md](CONTRIBUTING.md) (how to add a feature). This book goes deeper —
to the level of individual lines.

**Conventions.**

- Code is reproduced **verbatim** from the repository, in logical chunks. Each chunk is introduced by
  a header naming the file and the line range, like `-- parse.ts:23–37 --`, so you can hold the book
  next to the editor and confirm they match.
- Commentary follows each chunk as prose and `>` bullets that cite line numbers.
- Every code chapter ends with **Invariants & gotchas** and, where it helps, a **Check by hand**
  exercise: a tiny input and its answer, which you can verify with pencil.
- A reference like `numbering.ts:42` means *file `src/compiler/numbering.ts`, line 42*.

**The two rules that explain everything.** Hold these in mind; nearly every design choice follows from
them.

1. **Resolve data at compile time; render chrome at runtime.** The compiler computes numbers, reference
   targets, the table-of-contents tree, and KaTeX HTML, and ships them as attributes, JSON islands, and
   pre-rendered fragments. It *never* draws an environment header or a UI control — every tag is renamed
   to `<delta-…>` and a matching custom element builds the visible chrome in the browser.
2. **The output references nothing external.** No `<link>`, no `http(s)` URL, no `fetch`. Fonts and
   images are inlined as `data:` URIs; CSS and the runtime are inlined as text. This is forced by the
   target: a file opened from `file://` cannot fetch its siblings. A test
   (`test/emit.test.ts`) guards the invariant.

---

## Table of contents

**Part I — Orientation**
- Chapter 1 · What Delta compiles, and why
- Chapter 2 · The pipeline at a glance
- Chapter 3 · A worked example — one document through every pass

**Part II — The shared substrate**
- Chapter 4 · `ast.ts` — the generic tree
- Chapter 5 · `context.ts` — the spine every pass writes to

**Part III — From text to tree**
- Chapter 6 · `preprocess.ts` — making math safe for XML
- Chapter 7 · `parse.ts` — strict XML to a generic AST
- Chapter 8 · `include.ts` — merging files (the first pass)

**Part IV — Resolving data**
- Chapter 9 · `environments.ts` — the numbering data table
- Chapter 10 · `numbering.ts` — assigning numbers, filling the registry
- Chapter 11 · `math.ts` — compile-time KaTeX
- Chapter 12 · `references.ts` — the canonical cross-cutting pass
- Chapter 13 · `toc.ts` — the heading tree and auto-slugs
- Chapter 14 · `figures.ts` & `theme.ts` — inlining local assets
- Chapter 15 · `strings.ts` — internationalization (babel)

**Part V — Producing the output**
- Chapter 16 · `emit.ts` & `katex-css.ts` — serialization and the final HTML
- Chapter 17 · `index.ts` — the orchestrator, read last

**Part VI — Multi-file projects**
- Chapter 18 · `config.ts` — the project file (`project.toml`)
- Chapter 19 · `project.ts` — compiling many files as one work

**Appendices**
- A · The complete pass order and the `CompileContext` field matrix
- B · The "no external resources" invariant
- C · The three shapes a feature can take
- D · Glossary
- E · Map to the real source

---

# Part I — Orientation

## Chapter 1 · What Delta compiles, and why

A Delta document is strict XML. Here is a small but representative one:

```xml
<document lang="en">
  <toc/>
  <section id="intro">
    <title>Warm-up</title>
    Pythagoras said $a^2 + b^2 = c^2$.
    <theorem id="pyth"><title>Right triangles</title>It holds.</theorem>
    See <ref to="pyth"/>.
  </section>
</document>
```

Notice what the author did *not* write: no theorem number, no "Theorem 1.1" header, no table of
contents entries, no `<script>`, no CSS. They wrote *content and intent*. The compiler's job is to turn
intent into data — *theorem `pyth` is number 1.1*, *the reference points there*, *the contents lists
"Warm-up"* — and to hand that data to a tiny runtime that paints it.

**Why "offline from `file://`" shapes the whole design.** The promised artifact is a single `.html`
you can email, drop on a USB stick, or open by double-clicking. A page loaded from `file://` is the
most hostile environment a web document faces: `fetch()` is blocked, there is no server to ask for the
next chapter, relative URLs to fonts may or may not resolve. So Delta refuses to depend on any of it.
Everything the page needs — the KaTeX stylesheet, its woff2 fonts, every image, the JavaScript runtime,
even the content of a *cross-referenced* element from another file — is **inlined** into the one HTML
file at compile time. When you read later that a reference "ships a copy of its target" or that a font
is "a `data:` URI," this constraint is the reason.

**Why a compile step at all** (rather than rendering in the browser, like MathML or a JS framework)?
Three reasons recur:

- **Numbering, references, and contents need global knowledge.** "Theorem 1.1" requires counting every
  numbered thing before it; a `<ref>` needs to know the target's number even if the target lives in
  another file. The browser, on `file://`, cannot read other files. The compiler can.
- **KaTeX is large.** Rendering math in the browser would ship a megabyte of JavaScript. Delta runs
  KaTeX *once, at compile time*, and ships only the resulting HTML plus the (smaller) CSS.
- **The author writes math freely.** `$a < b$` contains a `<`, which is illegal in XML. A pre-pass
  escapes those characters before the XML parser ever sees them, so authors are not forced to write
  `&lt;` inside formulas.

That is the entire value proposition: **move every computation that needs global knowledge, or that is
expensive, to compile time, and emit a dumb, self-contained, offline page.**

## Chapter 2 · The pipeline at a glance

Compilation is a straight line of passes. Source text goes in at the top; an HTML string comes out at
the bottom. Each pass takes the same two arguments — the document tree and a mutable context — and
mutates them in place.

```
   raw .dlt text
        |
        
   preprocess        escape < > & inside $…$ and raw tags      (string → string)
        |
        
   parse             strict XML → generic AST                  (string → ElementNode)
        |
        
   resolveIncludes   splice <include> files into one tree
        |
        
   loadBibliography  build ctx.papers from <paper>/.ref; empty the <bibliography>
        |
        
   resolveCitations  number <cite> by first appearance; refill the <bibliography>
        |
        
   numberDocument    assign num="1.2"; fill ctx.registry
        |
        
   renderMath        $…$ and <m>/<equation> → KaTeX HTML; sets ctx.mathUsed
        |
        
   resolveReferences <ref to> → num+kind; fill ctx.referencedIds
        |
        
   buildToc          collect heading tree → ctx.toc (if a <toc> is present)
        |
        
   inlineFigures     <figure src> images → data: URIs
        |
        
   resolveTheme      <document theme> CSS → ctx.userCss
        |
        
   resolveImports    <import> packs → ctx.imports (JS after runtime, CSS before theme)
        |
        
   emit              rename tags to <delta-*>, assemble the single HTML file
        |
        
   standalone .html
```

Two things make this picture work.

**One mutable context, threaded everywhere.** A single `CompileContext` object (Chapter 5) is created
per compile and passed to every pass. Passes never call each other and share no globals; they
communicate *only* by writing fields on the context (and attributes on tree nodes) that a later pass
reads. The numbering pass writes `ctx.registry`; the reference pass reads it. The math pass sets
`ctx.mathUsed`; the emitter reads it to decide whether to inline a megabyte of KaTeX CSS. This is why
**pass order is load-bearing**: a reader cannot resolve against a registry that has not been filled yet.

**The tree is generic and mutated in place.** There is no `TheoremNode` class. Every tag is an
`ElementNode` with a `tag` string and an `attrs` bag (Chapter 4). A pass that "numbers a theorem" does
nothing more exotic than set `el.attrs.num = "1.1"`. A pass that "renders math" *replaces* a text node
with a `RawNode` holding KaTeX HTML. By the time `emit` runs, all the data the page needs is sitting in
the tree as attributes and pre-rendered fragments, plus a few fields on the context.

The orchestrator that calls these in order is `index.ts` (`compileSource`), which we deliberately read
**last** (Chapter 17), once each pass it names is familiar.

## Chapter 3 · A worked example — one document through every pass

Before reading any source, let us trace the document from Chapter 1 through the pipeline by hand. Keep
this example in mind; the file chapters explain *how* each transformation below is achieved.

The input again:

```xml
<document lang="en">
  <toc/>
  <section id="intro">
    <title>Warm-up</title>
    Pythagoras said $a^2 + b^2 = c^2$.
    <theorem id="pyth"><title>Right triangles</title>It holds.</theorem>
    See <ref to="pyth"/>.
  </section>
</document>
```

**1 · preprocess.** Scans the raw text. Inside `$a^2 + b^2 = c^2$` there are no `<`, `>`, or `&`, so
nothing changes. (Had the author written `$a < b$`, this pass would rewrite it to `$a &lt; b$` so the
XML parser does not choke on the `<`; a later step turns it back.) Output: a string, almost identical
to the input.

**2 · parse.** Builds the generic tree. Sketched (text nodes shown as quoted strings):

```
document(lang="en")
|-- toc
|_- section(id="intro")
   |-- title → "Warm-up"
   |-- "Pythagoras said $a^2 + b^2 = c^2$."
   |-- theorem(id="pyth")
   |  |-- title → "Right triangles"
   |  |_- "It holds."
   |_- "See " · ref(to="pyth") · "."
```

**3 · resolveIncludes.** There is no `<include>`, so the tree is unchanged. (If `section` had contained
`<include src="more.dlt"/>`, that node would be replaced here by the children of `more.dlt`'s
`<document>`.)

**4 · numberDocument.** Walks the tree in order. `section` increments the `section` counter → `num="1"`;
`theorem` increments the `theorem` counter, prefixed by the section → `num="1.1"`. Every element with an
`id` is recorded in the registry:

```
ctx.registry = { "intro" → {tag:"section",  num:"1"},
                 "pyth"  → {tag:"theorem",  num:"1.1"} }
```

**5 · renderMath.** Finds `$a^2 + b^2 = c^2$` inside the section's text and replaces that one text node
with three: the leading `"Pythagoras said "`, a **RawNode** holding the KaTeX HTML for the formula, and
the trailing `"."`. Sets `ctx.mathUsed = true`.

**6 · resolveReferences.** Finds `ref(to="pyth")`, looks `pyth` up in the registry, and writes the
answer onto the node: `attrs.num="1.1"`, `attrs.kind="theorem"`. Records `ctx.referencedIds = {"pyth"}`
so the emitter knows to ship a copy of the theorem for the pop-over.

**7 · buildToc.** The document contains `<toc>`, so the heading tree is collected. Only `section` is a
heading (a `theorem` is not), so:

```
ctx.toc = [ {level:2, id:"intro", num:"1", title:[text "Warm-up"]} ]
```

(Had `section` lacked an `id`, this pass would have *generated* one — `warm-up` — and written it back
onto the node so the contents link resolves.)

**8 · inlineFigures.** No `<figure>`, unchanged.

**9 · resolveTheme.** No `theme=` attribute on `<document>`, so `ctx.userCss` stays undefined.

**10 · emit.** Serializes the finished tree into the single HTML file. Every tag is renamed with a
`delta-` prefix; the resolved data rides along as attributes; the cross-reference target and the
contents tree are emitted as inert islands. Abbreviated:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"> …
  <style> /* CORE_CSS */ </style>
  <style> /* the article theme layer */ </style>
  <style> /* KaTeX CSS — present because ctx.mathUsed */ </style>
</head>
<body>
<delta-document lang="en">
  <delta-toc></delta-toc>
  <delta-section id="intro" num="1">
    <delta-title>Warm-up</delta-title>
    Pythagoras said <span class="katex">…</span>.
    <delta-theorem id="pyth" num="1.1">
      <delta-title>Right triangles</delta-title>It holds.
    </delta-theorem>
    See <delta-ref to="pyth" num="1.1" kind="theorem"></delta-ref>.
  </delta-section>
</delta-document>
<template data-delta-pop="pyth"><delta-theorem id="pyth" num="1.1">…</delta-theorem></template>
<script type="application/json" id="delta-toc">[{"level":2,"id":"intro","num":"1","title":"Warm-up"}]</script>
<script type="application/json" id="delta-i18n">{"theorem":"Theorem",…}</script>
<script> /* the inlined runtime */ </script>
</body>
</html>
```

Nothing in that output draws "Theorem 1.1 (Right triangles)." or the contents list. The *data* to do so
is all present — the `num` attribute, the `#delta-toc` island, the `#delta-i18n` labels — and the
runtime custom elements assemble the visible chrome when the page loads. That division is rule 1, made
concrete.

With the shape of the journey clear, the rest of the book reads the machinery one file at a time.

# Part II — The shared substrate

Two files underlie every pass: `ast.ts` defines the tree the passes walk, and `context.ts` defines the
object they communicate through. Read these two carefully; the other fourteen files are variations on
"walk the `ast`, read and write the `context`."

## Chapter 4 · `ast.ts` — the generic tree

**Role.** Defines the node types and two helpers (`elements`, `textContent`). It imports nothing and is
imported by almost everything. There is no behavior here beyond two tiny walks — but the *shape* it
chooses is the single most important design decision in the compiler.

### The node types

```
-- ast.ts:1–32 --
/**
 * Delta's AST is deliberately generic: every tag is an ElementNode keyed by `tag`.
 * Passes branch on `tag` and write computed results back into `attrs` (e.g. the
 * numbering pass writes `num`); there are no per-feature node subclasses, so adding
 * an environment is configuration, not a new node type. RawNode carries pre-rendered
 * HTML (KaTeX output) that the emitter must not escape.
 */

export interface Position {
  line: number;
  column: number;
}

export interface TextNode {
  type: "text";
  text: string;
}

export interface RawNode {
  type: "raw";
  html: string;
}

export interface ElementNode {
  type: "element";
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
  pos?: Position;
}

export type Node = ElementNode | TextNode | RawNode;
```

There are exactly **three** node types, distinguished by a `type` string (a discriminated union):

- > `TextNode` (14–17): a run of literal text.
- > `RawNode` (19–22): a fragment of **already-rendered HTML** that must be emitted *unescaped*. Only
  the math pass produces these (KaTeX output); the emitter prints `node.html` byte-for-byte. This is the
  one place the compiler trusts a string as HTML, and it is trusted because KaTeX produced it.
- > `ElementNode` (24–30): any tag. It carries its `tag` name, a string→string `attrs` map, an ordered
  list of `children`, and an optional source `pos` (used by diagnostics to point at the offending line).

The comment at the top (1–7) states the philosophy: **the AST has no per-feature subclasses.** There is
no `Theorem` class or `Section` class. A theorem is just `ElementNode` with `tag === "theorem"`. The
consequences ripple through the whole compiler:

- Passes **branch on the `tag` string** (`if (el.tag === "ref")`) or look the tag up in a table
  (`ENVIRONMENTS[el.tag]`), rather than on a class.
- Passes **write results back into `attrs`** as strings (`el.attrs.num = "1.1"`). Attributes are the
  blackboard: they survive from the pass that computes them all the way to the emitter, which copies
  them onto the `<delta-*>` output verbatim.
- **Adding a new numbered environment is data, not code** (Chapter 9): you add a row to a table, not a
  subclass here.

- > `pos?` (29) is optional because not every node has a known source position (synthesized nodes do
  not), and diagnostics treat position as best-effort.

### The two helpers

```
-- ast.ts:34–51 --
export function textContent(node: Node): string {
  switch (node.type) {
    case "text":
      return node.text;
    case "raw":
      return "";
    case "element":
      return node.children.map(textContent).join("");
  }
}

/** Depth-first walk over `root` and all descendant elements. */
export function* elements(root: ElementNode): Generator<ElementNode> {
  yield root;
  for (const child of root.children) {
    if (child.type === "element") yield* elements(child);
  }
}
```

- > `textContent` (34–43) flattens a node to its plain text: a text node yields its text, an element
  yields the concatenation of its children's text, and — note carefully — a **raw node yields the empty
  string** (38–39). This is correct but has a sharp edge: the text of a title that contains inline math
  (`<title>The $L^2$ space</title>`) loses the math, because by the time anyone calls `textContent` the
  `$L^2$` may already be a `RawNode`. The TOC pass (Chapter 13) is built around this fact — it captures
  a heading's *child nodes*, not its `textContent`, precisely so math survives into the contents.
- > `elements` (46–51) is a generator doing a pre-order depth-first walk: it `yield`s `root` first, then
  recurses into each element child. Most passes that need "every `<ref>` in the document" simply write
  `for (const el of elements(doc)) if (el.tag === "ref") …`. Because it is a generator, it allocates no
  array and the caller can `break` early.

**Invariants & gotchas.**

- The union is closed at three members; the `switch` in `textContent` is exhaustive, so TypeScript will
  flag any future fourth node type that forgets a case.
- `elements` yields the root itself — a subtlety the figures/TOC passes rely on, but which means a
  count of "how many `document` tags" includes the root (you saw this in Chapter 3's example).
- A `RawNode` is HTML. Never pass author text through a `RawNode`; only KaTeX output earns that trust.

## Chapter 5 · `context.ts` — the spine every pass writes to

**Role.** Defines `CompileContext` — the single mutable object threaded through the whole pipeline — its
two payload types (`LabelEntry`, `TocEntry`), the constructor `createContext`, and the diagnostic
helpers `error` / `warn` / `hasErrors`. If `ast.ts` is the noun, `context.ts` is the shared notebook.

### Diagnostics and the two payload types

```
-- context.ts:1–26 --
import type { Node, Position } from "./ast";

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
}
```

- > `Diagnostic` (3–8) is a problem report: a severity, a human message, the file it occurred in, and an
  optional source position. Crucially, the compiler does **not** throw on author mistakes — it pushes a
  `Diagnostic` and keeps going. The CLI prints them at the end; an `error` suppresses output, a
  `warning` does not. (This "diagnostics, not exceptions" stance is why you will see `warn(ctx, …)` and
  `error(ctx, …)` rather than `throw` throughout.)
- > `LabelEntry` (11–14) is what the numbering pass stores for each `id`: the element's `tag` and its
  computed `num`. The reference pass (Chapter 12) reads exactly this to turn `<ref to="pyth">` into
  "Theorem 1.1".
- > `TocEntry` (17–26) is one contents row. Note `title: Node[]` (25) — the heading's **child nodes**,
  not a string. Storing nodes (rather than text) is the deliberate workaround for `textContent`'s
  math-dropping (Chapter 4); the emitter serializes those nodes so a heading's math reaches the
  contents. `num` may be `""` (23) for an unnumbered heading; `level` (18–19) encodes the depth.

### The context object and its constructor

```
-- context.ts:28–59 --
/**
 * One mutable context is threaded through every pass and into the emitter.
 * Passes communicate through it (and through node attrs) — nothing else is shared.
 */
export interface CompileContext {
  file: string;
  diagnostics: Diagnostic[];
  /** id → numbering info; written by numbering, read by the reference pass. */
  registry: Map<string, LabelEntry>;
  /** Target ids that a `<ref>` resolved to; emit snapshots each into a `<template>`. */
  referencedIds: Set<string>;
  /** Heading tree for the table of contents; built by `buildToc`, emit ships it as a JSON island. */
  toc: TocEntry[];
  /** Set by the math pass; gates inlining KaTeX CSS (~1 MB with embedded fonts). */
  mathUsed: boolean;
  /** Document `lang` (raw author value, default "en"); drives i18n and `<html lang>`. */
  lang: string;
  /** Author CSS from `<document theme>`, resolved by the theme pass; emit inlines it last. */
  userCss?: string;
}

export function createContext(file: string): CompileContext {
  return {
    file,
    diagnostics: [],
    registry: new Map(),
    referencedIds: new Set(),
    toc: [],
    mathUsed: false,
    lang: "en",
  };
}
```

Each field is owned by one pass and consumed by another — the comments say which. Read it as a contract:

- > `file` (33): the path of the source being compiled. Used for diagnostics (which file the error is
  in) and, importantly, as the base directory for resolving *relative* paths — figures, themes, and
  includes all resolve `src` against `dirname(ctx.file)`. The include pass temporarily reassigns this as
  it recurses into other files (Chapter 8).
- > `diagnostics` (34): the growing list of problems.
- > `registry` (36): `id → {tag, num}`, written by `numberDocument`, read by `resolveReferences`. The
  heart of cross-referencing.
- > `referencedIds` (38): the set of ids some `<ref>` actually pointed at, written by
  `resolveReferences`, read by `emit` to decide which elements to snapshot into pop-over `<template>`s.
  Only referenced targets are copied — so the output carries no dead weight.
- > `toc` (40): the heading tree, written by `buildToc`, shipped by `emit` as the `#delta-toc` island.
- > `mathUsed` (42): a boolean set by `renderMath` the first time it renders anything. The emitter reads
  it to decide whether to inline KaTeX's stylesheet — roughly a megabyte once its fonts are embedded —
  so a math-free document pays nothing.
- > `lang` (44): the document language, defaulting to `"en"`. Drives which i18n strings are inlined and
  the `<html lang>` attribute.
- > `userCss?` (46): the author's theme CSS, read by `resolveTheme`, inlined *last* by `emit` so it wins
  the cascade. Optional — present only when `<document theme="…">` resolved.

- > `createContext` (49–59) simply returns a fresh context with empty collections. `userCss` is absent
  (it is optional, set only if a theme resolves); everything else starts empty/zero/`"en"`.

### The diagnostic helpers

```
-- context.ts:61–71 --
export function error(ctx: CompileContext, message: string, pos?: Position): void {
  ctx.diagnostics.push({ severity: "error", message, file: ctx.file, pos });
}

export function warn(ctx: CompileContext, message: string, pos?: Position): void {
  ctx.diagnostics.push({ severity: "warning", message, file: ctx.file, pos });
}

export function hasErrors(ctx: CompileContext): boolean {
  return ctx.diagnostics.some((d) => d.severity === "error");
}
```

- > `error` / `warn` (61–67) are one-liners that stamp the current `ctx.file` onto a new diagnostic and
  push it. The distinction is policy: `error` means *the build should not produce output*; `warn` means
  *something is off but the page is still usable* (a missing image, an unresolved reference).
- > `hasErrors` (69–71) is what the orchestrator checks after the parse and after includes to decide
  whether to bail (`index.ts:27,29`). Warnings never stop the build; errors do.

**Invariants & gotchas.**

- Passes share state **only** through this object and through node `attrs`. There are no module-level
  globals. That is what makes the pipeline easy to reason about and to test pass-by-pass.
- `error` does not throw and does not immediately stop anything — it only records. Stopping happens when
  the orchestrator next consults `hasErrors`. So a pass that hits a fatal problem typically records an
  error *and returns early* on its own, trusting the orchestrator to abort before emit.
- Because `ctx.file` doubles as the relative-path base, any pass that follows includes into another file
  must save and restore it (Chapter 8 does exactly this).

**Check by hand.** After numbering the Chapter 3 example, what are the *keys* of `ctx.registry`, and
what is `ctx.referencedIds` after the reference pass? *Answer:* keys `{"intro","pyth"}`; referenced ids
`{"pyth"}` (only `pyth` was the target of a `<ref>`; `intro` has an id but nobody referenced it).

# Part III — From text to tree

The first three passes turn a string into a clean, merged tree: `preprocess` makes the text safe for an
XML parser, `parse` builds the generic AST, and `resolveIncludes` stitches in any other files. After
this part, the document is one tree, ready for the data passes of Part IV.

## Chapter 6 · `preprocess.ts` — making math safe for XML

**Role.** Runs on the **raw string**, before any XML parsing. Its single job: let authors write `<`,
`>`, and `&` freely inside math (`$…$`, `$$…$$`) and inside "raw" tags (`<m>`, `<code>`, …), by
entity-escaping those characters *only inside those regions* so the document stays well-formed XML.
Everywhere else the text is copied through untouched. It is a hand-written character scanner — not a
regex — because the rules are contextual (am I inside math? inside a raw tag? inside a tag's quoted
attribute?).

Why this has to exist: `$a < b$` is natural math but illegal XML (`<` opens a tag). Forcing authors to
write `$a &lt; b$` would be miserable. So Delta escapes the `<` to `&lt;` here; the XML parser then sees
valid markup; and saxes *un*escapes entities back to `<` when it reports text, so every later pass sees
the original character. The author's experience is "just write math."

### The tables and a tiny helper

```
-- preprocess.ts:1–16 --
/**
 * Runs on raw `.dlt` text before XML parsing. Authors may write `<`, `>` and `&`
 * freely inside math (`$…$`, `$$…$$`) and inside RAW_TAGS content; this pass
 * entity-escapes those regions so the document stays well-formed XML. The parser
 * unescapes them again, so later passes see the original characters. `\$` is a
 * literal dollar and never opens math (the math pass unescapes it).
 */

/** Tags whose text content is taken literally — protected here, never `$`-scanned. */
export const RAW_TAGS = new Set(["m", "math", "equation", "equations", "code", "codeblock"]);

const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;" };

function escapeRegion(s: string): string {
  return s.replace(/[&<>]/g, (c) => ENTITIES[c]);
}
```

- > `RAW_TAGS` (10) is exported because the math pass imports it too (Chapter 11): both passes must agree
  on which tags hold literal, non-`$`-scanned content. Note `&` is listed first in `ENTITIES` (12); if
  you escaped `<` to `&lt;` *before* escaping `&`, you would then double-escape that new `&`. Using a
  single `replace` with the character class `[&<>]` (15) sidesteps the ordering problem — each original
  character is replaced exactly once.
- > `escapeRegion` (14–16) is the workhorse applied to every protected region.

### The main scanner

```
-- preprocess.ts:18–67 --
export function preprocess(source: string): string {
  let out = "";
  let i = 0;
  let math: "$" | "$$" | null = null;

  while (i < source.length) {
    const ch = source[i];

    if (math) {
      if (ch === "\\" && source[i + 1] === "$") {
        out += "\\$";
        i += 2;
        continue;
      }
      if (ch === "$" && source.startsWith(math, i)) {
        out += math;
        i += math.length;
        math = null;
        continue;
      }
      out += escapeRegion(ch);
      i++;
      continue;
    }

    if (ch === "\\" && source[i + 1] === "$") {
      out += "\\$";
      i += 2;
      continue;
    }

    if (ch === "$") {
      math = source[i + 1] === "$" ? "$$" : "$";
      out += math;
      i += math.length;
      continue;
    }

    if (ch === "<") {
      const copied = copyMarkup(source, i);
      out += copied.text;
      i = copied.end;
      continue;
    }

    out += ch;
    i++;
  }
  return out;
}
```

The scanner walks the source one position at a time, building `out`, with one bit of state: `math` —
either `null` (in prose), or the delimiter we are inside (`"$"` or `"$$"`).

- > **Inside math** (12–25 of the chunk; lines 26–41 of the file): a `\$` is copied literally and does
  *not* close math (27–31) — it is an escaped dollar the author wants to print. The closing delimiter
  must match what opened (32: `source.startsWith(math, i)` ensures `$$` is not closed by a single `$`);
  on match we emit it and drop back to prose (33–36). Any other character is **escaped** (38) — this is
  the whole point: inside math, `<`/`>`/`&` become entities.
- > **In prose**, a `\$` is again passed through literally (43–47), so an escaped dollar never opens
  math.
- > A `$` in prose **opens** math (49–54): peek at the next character to decide `$$` vs `$`, emit the
  delimiter, and set the state. From here the `if (math)` branch takes over until the matching close.
- > A `<` in prose (56–61) means markup begins; the scanner hands off to `copyMarkup`, which copies a
  whole tag/comment/CDATA verbatim and returns where it ended. We do **not** escape `<` here — in prose
  it is real XML.
- > Anything else (63–64) is ordinary prose, copied through. (A bare `&` or `>` in prose is the author's
  responsibility — those must already be valid XML outside math/raw regions.)

### Copying markup verbatim, and protecting raw-tag bodies

```
-- preprocess.ts:69–115 --
/**
 * Copies one piece of markup verbatim starting at `<`: a comment, CDATA section,
 * declaration, or tag (quotes in attribute values respected, so `>` inside them
 * doesn't end the tag). When the tag opens a RAW_TAG, its content is escaped up
 * to the closing tag — raw content is opaque, so nothing inside it is scanned.
 */
function copyMarkup(source: string, start: number): { text: string; end: number } {
  for (const [open, close] of [
    ["<!--", "-->"],
    ["<![CDATA[", "]]>"],
  ] as const) {
    if (source.startsWith(open, start)) {
      const at = source.indexOf(close, start + open.length);
      const end = at === -1 ? source.length : at + close.length;
      return { text: source.slice(start, end), end };
    }
  }

  let i = start + 1;
  let quote: string | null = null;
  while (i < source.length) {
    const c = source[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      break;
    }
    i++;
  }
  const end = Math.min(i + 1, source.length);
  let text = source.slice(start, end);

  const name = /^<([A-Za-z][\w-]*)/.exec(text);
  const selfClosing = /\/\s*>$/.test(text);
  if (name && RAW_TAGS.has(name[1]) && !selfClosing) {
    const closeTag = new RegExp(`</\\s*${name[1]}\\s*>`);
    const rest = source.slice(end);
    const match = closeTag.exec(rest);
    if (match) {
      text += escapeRegion(rest.slice(0, match.index)) + match[0];
      return { text, end: end + match.index + match[0].length };
    }
  }
  return { text, end };
}
```

`copyMarkup` is called at every `<`. It returns the copied text and the index just past it.

- > **Comments and CDATA** (76–86) are copied wholesale to their closing delimiter (or end of file if
  unterminated). Nothing inside is scanned — a comment may legitimately contain `<` or `$`.
- > **A tag** (87–101): scan forward to the closing `>`, but respect quotes — a `>` inside an attribute
  value like `alt="a > b"` must not end the tag (91–94). The `quote` variable tracks whether we are
  inside `"…"` or `'…'`.
- > **Raw-tag bodies** (103–113) are the subtle part. After copying the open tag, we check: is this a
  `RAW_TAG`, and is it *not* self-closing (104–105)? If so, its entire body — up to the matching close
  tag — is opaque literal content (think `<m>a < b</m>` or a code block). We escape that whole body with
  `escapeRegion` and append it plus the close tag (110), then report the end past the close tag (111).
  This is why you write `&`, not `&amp;`, inside `<m>` and `<code>`: the body is protected here and the
  parser unescapes it later. A self-closing `<m/>` has no body, so it is skipped.
- > If a raw tag is unterminated (no close tag found), we fall through and return just the open tag
  (114) — the malformed markup will surface as an error in the parser.

**Invariants & gotchas.**

- This pass produces **valid XML** from author-friendly input. Everything downstream assumes that.
- The pairing with the parser is essential: escape here, the parser unescapes, later passes see raw
  characters. Neither half is correct alone.
- `RAW_TAGS` must match between this file and `math.ts`. Add a raw tag in one place only and you get
  either unescaped `<` reaching the parser, or `$` wrongly scanned inside literal content.

**Check by hand.** What does `preprocess("Let $a<b$ and <m>x&y</m>.")` produce? *Answer:*
`"Let $a&lt;b$ and <m>x&amp;y</m>."` — the `<` inside `$…$` became `&lt;`, the `&` inside `<m>` became
`&amp;`, and the tags/prose are otherwise untouched.

## Chapter 7 · `parse.ts` — strict XML to a generic AST

**Role.** Turns the (now well-formed) string into the generic tree from Chapter 4, using the streaming
SAX parser `saxes`. Returns the root `ElementNode` (the `<document>`), or `null` if the XML is
malformed — recording diagnostics with line/column either way. It is event-driven and stack-based, and
the whole thing is under 60 lines.

### Setup and the error handler

```
-- parse.ts:1–20 --
import { SaxesParser } from "saxes";
import type { ElementNode } from "./ast";
import { error, type CompileContext } from "./context";

/**
 * Strict XML → generic AST. Returns the root element (usually `<document>`), or
 * null when the source is not well-formed — the diagnostics explain why, with
 * source positions.
 */
export function parse(source: string, ctx: CompileContext): ElementNode | null {
  const parser = new SaxesParser();
  const root: ElementNode = { type: "element", tag: "#root", attrs: {}, children: [] };
  const stack: ElementNode[] = [root];
  let failed = false;

  parser.on("error", (err) => {
    failed = true;
    // saxes prefixes messages with "file:line:column:"; the diagnostic carries those.
    const message = err.message.replace(/^.*?:\d+:\d+:\s*/, "");
    error(ctx, message, { line: parser.line, column: parser.column });
  });
```

- > `root` (12) is a **synthetic** node with the sentinel tag `#root`. It is never part of the output;
  it exists only to be the initial parent so the handlers never special-case "top level." The real
  document will be its single element child.
- > `stack` (13) holds the chain of currently-open elements, `root` at the bottom. The top of the stack
  is always the element whose children we are currently collecting. This is the entire parsing
  algorithm: push on open, pop on close.
- > `failed` (14) records whether any XML error fired, so we can return `null` afterwards.
- > The error handler (16–20) sets `failed`, strips saxes's `file:line:col:` prefix from the message
  (so our diagnostic does not duplicate the position), and records an `error` with the parser's current
  line/column. Note: parsing is not aborted on the first error — saxes keeps going — but `failed`
  guarantees we return `null`.

### The element and text handlers

```
-- parse.ts:22–46 --
  parser.on("opentag", (tag) => {
    const el: ElementNode = {
      type: "element",
      tag: tag.name,
      attrs: { ...(tag.attributes as Record<string, string>) },
      children: [],
      pos: { line: parser.line, column: parser.column },
    };
    stack[stack.length - 1].children.push(el);
    stack.push(el);
  });

  parser.on("closetag", () => {
    stack.pop();
  });

  const addText = (text: string): void => {
    const siblings = stack[stack.length - 1].children;
    const last = siblings[siblings.length - 1];
    if (last?.type === "text") last.text += text;
    else siblings.push({ type: "text", text });
  };
  parser.on("text", addText);
  parser.on("cdata", addText);
```

- > **opentag** (22–32): build an `ElementNode` from the tag's name and attributes (spread into a fresh
  object so we own it), stamp the source position, then do the two stack moves — **append the new node
  to the current top's children** (30), then **push it as the new top** (31). After this, any text or
  child tags belong to `el` until its close.
- > **closetag** (34–36): just pop. The element we were filling is done; its parent becomes the top
  again. (saxes has already validated that close tags match open tags, so no name check is needed here.)
- > **text / cdata** (38–45): append a `TextNode`, but **coalesce** with a preceding text sibling
  (40–42) so a run of text split across SAX events becomes one node. This keeps the tree tidy and makes
  later text-scanning passes (like math) simpler. `cdata` is routed to the same handler (45) — CDATA is
  just literal text to us. (Recall: saxes unescapes entities here, so the `&lt;` that `preprocess`
  produced arrives as a real `<`.)

### Finishing and extracting the root

```
-- parse.ts:47–57 --
  parser.write(source).close();
  if (failed) return null;

  const doc = root.children.find((c): c is ElementNode => c.type === "element");
  if (!doc) {
    error(ctx, "no root element found");
    return null;
  }
  return doc;
}
```

- > `parser.write(source).close()` (47) drives the whole parse synchronously — saxes fires all the
  events during this call. By the time it returns, the tree under `root` is fully built.
- > If any error fired, return `null` (48).
- > Otherwise find `root`'s first **element** child (50) — skipping any leading whitespace text — and
  return it. That is the `<document>`. If there is no element at all, that is an error too (51–53).

This is why an included file (Chapter 8) must be single-rooted: `parse` returns *one* element. A file
with two top-level elements would silently yield only the first. The decision to require a `<document>`
wrapper for includes follows directly from this line.

**Invariants & gotchas.**

- The `#root` sentinel is never emitted; it is plumbing. The returned node is the document.
- Parsing does not throw on bad XML — it records diagnostics and returns `null`. The orchestrator checks
  `hasErrors`/`null` and bails.
- Adjacent text is coalesced, but text separated by an element is not (there is an element between
  them). So `A<b/>C` yields three children: text `"A"`, element `b`, text `"C"`.

## Chapter 8 · `include.ts` — merging files (the first pass)

**Role.** The first transform after parsing. It replaces every `<include src="part.dlt">` with the
children of that file's `<document>`, recursively, so the rest of the pipeline sees a single merged
tree. It detects cycles, resolves paths relative to the *including* file, rewrites relative asset paths
so they survive the move, and treats a missing/cyclic/non-local include as a fatal `error`.

It is the cleanest illustration of two patterns: **in-place tree rewriting via `flatMap`** (borrowed
from the math pass), and **following `ctx.file` into another file** for correct relative-path and
diagnostic behavior.

### The header, the asset set, and the entry point

```
-- include.ts:1–26 --
import { readFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import type { ElementNode, Node } from "./ast";
import { error, type CompileContext } from "./context";
import { parse } from "./parse";
import { preprocess } from "./preprocess";

/**
 * Resolves `<include src="part.dlt">` at compile time: reads the referenced file,
 * parses it, strips its `<document>` wrapper, and splices its children in place of
 * the `<include>` node. Runs first (before numbering) so the rest of the pipeline
 * sees one merged tree. Recursive, with cycle detection.
 *
 * Because spliced nodes leave their home directory behind, relative asset `src`s
 * (`figure`/`video`/`audio`) are rewritten relative to the master document, so an
 * included file in a sub-directory can still reference its own images.
 *
 * A missing/cyclic/non-local include is an `error` (the build fails) — a missing
 * include means missing content, like a missing LaTeX `\input`.
 */
const ASSET_TAGS = new Set(["figure", "video", "audio"]);

export function resolveIncludes(doc: ElementNode, ctx: CompileContext): void {
  const masterDir = resolve(dirname(ctx.file));
  walk(doc, masterDir, [resolve(ctx.file)], masterDir, ctx);
}
```

- > It imports `parse` and `preprocess` (5–6) — an included file goes through the *same* front end as
  the master. This is the recursion's base machinery.
- > `resolveIncludes` (23–26) computes `masterDir` (the absolute directory of the top-level file) and
  kicks off `walk` with two seeds: the current directory, and a **stack** containing the master's
  absolute path. The stack is the cycle detector — a file may not transitively include itself.

### `walk` — rewrite each children array

```
-- include.ts:28–43 --
/** Resolve includes within `node`, with `dir` = the directory of `node`'s file. */
function walk(
  node: ElementNode,
  dir: string,
  stack: string[],
  masterDir: string,
  ctx: CompileContext,
): void {
  node.children = node.children.flatMap((child): Node[] => {
    if (child.type !== "element") return [child];
    if (child.tag === "include") return expand(child, dir, stack, masterDir, ctx);
    rewriteAsset(child, dir, masterDir);
    walk(child, dir, stack, masterDir, ctx);
    return [child];
  });
}
```

- > `flatMap` (36) is the splice trick: each child maps to an *array* of replacement nodes, and
  `flatMap` flattens them back into one children list. A normal node maps to `[child]` (itself); an
  `<include>` maps to **its file's resolved children** — possibly several nodes, possibly none. This is
  how one node becomes many in place.
- > For a normal element (39–40), first `rewriteAsset` (fix a relative `src` if needed), then recurse
  with `walk` to resolve includes nested deeper inside it. `dir` is unchanged because the element
  belongs to the same file.
- > The returned children from `expand` were *already* fully walked (see below), so `flatMap` does not
  re-process them — no double work, no double rewrite.

### `expand` — read, parse, recurse, splice

```
-- include.ts:45–92 --
/** Read + parse one `<include>` and return its (fully resolved) children. */
function expand(
  inc: ElementNode,
  dir: string,
  stack: string[],
  masterDir: string,
  ctx: CompileContext,
): Node[] {
  const src = inc.attrs.src;
  if (!src) {
    error(ctx, "<include> without a 'src' attribute", inc.pos);
    return [];
  }
  if (/^[a-z]+:\/\//i.test(src)) {
    error(ctx, `include src must be a local path, not a URL: ${src}`, inc.pos);
    return [];
  }

  const abs = resolve(dir, src);
  if (stack.includes(abs)) {
    const chain = [...stack, abs].map((p) => relative(masterDir, p) || p).join(" → ");
    error(ctx, `include cycle: ${chain}`, inc.pos);
    return [];
  }

  let text: string;
  try {
    text = readFileSync(abs, "utf8");
  } catch {
    error(ctx, `include file not found: ${src}`, inc.pos);
    return [];
  }

  // Attribute diagnostics from the included file to the included file.
  const prevFile = ctx.file;
  ctx.file = abs;
  const root = parse(preprocess(text), ctx);
  let kids: Node[] = [];
  if (root) {
    // Strip the <document> wrapper (a non-document single root is spliced as-is).
    kids = root.tag === "document" ? root.children : [root];
    const container: ElementNode = { type: "element", tag: "#include", attrs: {}, children: kids };
    walk(container, dirname(abs), [...stack, abs], masterDir, ctx);
    kids = container.children;
  }
  ctx.file = prevFile;
  return kids;
}
```

Read this as a sequence of guards, then the recursion:

- > **No `src`** (53–57) and **a URL `src`** (58–61) are errors that return `[]` (the include vanishes).
  A URL would break the offline invariant — you cannot inline a network resource at `file://` time.
- > **`abs`** (63) is the include resolved against the *current* file's directory, so a nested include
  resolves relative to *its* includer, not the master. **Cycle detection** (64–68): if `abs` is already
  on the stack, this include would loop; we build a readable chain (`a → b → a`) and error out.
- > **Reading the file** (70–76): a read failure is "not found," an error, `[]`.
- > **The recursion** (78–91) is the careful part. We **save and swap `ctx.file`** to the included path
  (79–80) so that any diagnostics raised while parsing or walking the included file point at *that*
  file, and so relative paths inside it resolve correctly. We `preprocess` + `parse` it (81) — the same
  front end. We **strip the wrapper** (85): a `<document>` contributes its children; a stray
  single-rooted fragment is spliced as-is. We wrap the kids in a throwaway `#include` container (86) and
  `walk` it with the *included* directory and the stack extended by `abs` (87) — that recursion resolves
  any includes nested inside the included file, with correct directories and cycle protection. Finally
  we **restore `ctx.file`** (90) so the parent continues with its own path, and return the resolved
  kids.

### `rewriteAsset` — keep relative images working after the move

```
-- include.ts:94–100 --
/** Rewrite a relative asset `src` so it resolves relative to the master document. */
function rewriteAsset(el: ElementNode, dir: string, masterDir: string): void {
  if (dir === masterDir || !ASSET_TAGS.has(el.tag)) return;
  const src = el.attrs.src;
  if (!src || src.startsWith("data:") || src.startsWith("/") || /^[a-z]+:\/\//i.test(src)) return;
  el.attrs.src = relative(masterDir, resolve(dir, src)).split(sep).join("/");
}
```

The problem this solves: a chapter at `chapters/intro.dlt` writes `<figure src="diagram.png">`, meaning
`chapters/diagram.png`. Once that figure is spliced into the master tree, the figures pass (Chapter 14)
will resolve `src` relative to the *master* directory — and miss the image. So at splice time:

- > Skip if the node is from the master directory anyway, or is not an asset tag (96).
- > Skip non-relative srcs: already-inlined `data:`, absolute `/…`, or remote `scheme://` (98).
- > Otherwise rewrite (99): resolve the `src` against the *included* file's directory to get the true
  target, then express it **relative to the master** directory. `.split(sep).join("/")` normalizes
  Windows separators to forward slashes for the URL. Now the figures pass, resolving against the master,
  finds the file.

**Invariants & gotchas.**

- This pass runs **first** (before numbering) so everything downstream sees one tree and numbering is
  continuous across files.
- The `<document>` wrapper of an included file is dropped, and so are its `lang`/`type`/`theme`
  attributes — the master governs those. Each included file is still independently compilable.
- Cycle detection keys on **absolute** paths (`resolve`), so `./a.dlt` and `a.dlt` are the same node.
- `ctx.file` is borrowed and must be restored; the save/restore around the recursion (79–90) is what
  makes nested diagnostics and relative paths correct.

**Check by hand.** A master `m.dlt` contains `<include src="chapters/a.dlt"/>`; `a.dlt` contains
`<include src="a.dlt"/>` (itself). What happens? *Answer:* an `include cycle:
chapters/a.dlt → chapters/a.dlt` error is recorded, the include yields `[]`, and `compileSource`
returns `undefined` (no output) because `hasErrors` is true after the pass.

# Part IV — Resolving data

Now the tree is merged and stable. The passes in this part compute the data the page needs but the
browser cannot: numbers, rendered math, resolved references, the contents tree, inlined assets, and the
localized label table. Each writes its result into node `attrs` or onto `ctx`, for the emitter to ship.

## Chapter 9 · `environments.ts` — the numbering data table

**Role.** Pure data, no functions. It declares *which* tags are numbered, which counter each uses, how
their numbers are prefixed, and which counters reset when a parent advances. The numbering pass
(Chapter 10) is a generic engine driven entirely by this table — which is why "add a numbered
environment" means "add a row here," not "write code."

### The spec type and the environment table

```
-- environments.ts:1–44 --
/**
 * Numbering is data-driven, LaTeX style. Each numbered tag maps to a counter; tags
 * may share one (the theorem family counts together, like `\newtheorem{lemma}[theorem]`).
 * `prefixWith` names a counter whose displayed number is prepended ("2.3"), skipped
 * while that counter is still 0. COUNTER_RESETS restarts child counters whenever a
 * parent counter increments. Adding a numbered environment is a row here — the
 * numbering pass needs no changes.
 */

export interface EnvironmentSpec {
  /** Counter this tag increments; tags sharing a counter number together. */
  counter: string;
  /** Counter whose displayed number prefixes this one. */
  prefixWith?: string;
}

export const ENVIRONMENTS: Record<string, EnvironmentSpec> = {
  chapter: { counter: "chapter" },
  section: { counter: "section", prefixWith: "chapter" },
  subsection: { counter: "subsection", prefixWith: "section" },
  subsubsection: { counter: "subsubsection", prefixWith: "subsection" },

  theorem: { counter: "theorem", prefixWith: "section" },
  proposition: { counter: "theorem", prefixWith: "section" },
  lemma: { counter: "theorem", prefixWith: "section" },
  corollary: { counter: "theorem", prefixWith: "section" },
  conjecture: { counter: "theorem", prefixWith: "section" },
  definition: { counter: "theorem", prefixWith: "section" },
  example: { counter: "theorem", prefixWith: "section" },
  claim: { counter: "theorem", prefixWith: "section" },
  observation: { counter: "theorem", prefixWith: "section" },

  exercise: { counter: "exercise", prefixWith: "section" },
  problem: { counter: "problem", prefixWith: "section" },

  equation: { counter: "equation", prefixWith: "section" },
  equations: { counter: "equation", prefixWith: "section" },
  figure: { counter: "figure", prefixWith: "section" },
  video: { counter: "video", prefixWith: "section" },
  youtube: { counter: "video", prefixWith: "section" },
  audio: { counter: "audio", prefixWith: "section" },

  remark: { counter: "remark", prefixWith: "section" }
};
```

- > Each entry maps a **tag** to a `counter` it increments and an optional `prefixWith` (10–15, 17+).
- > **Sharing a counter** makes tags count *together*: the whole theorem family — `theorem`,
  `proposition`, `lemma`, …, `observation` (23–31) — uses the single `"theorem"` counter, exactly like
  LaTeX's `\newtheorem{lemma}[theorem]`. So a lemma after Theorem 1.1 is Lemma 1.2. By contrast
  `exercise` and `problem` (33–34) have their own counters and number independently.
- > **`prefixWith`** names a counter whose current display is prepended: a theorem `prefixWith:
  "section"` becomes "1.1" (section 1, theorem 1). Sections themselves `prefixWith: "chapter"` (19), so
  in a book a section reads "2.3", but in a chapter-less article the chapter counter is 0 and the prefix
  is *skipped* (the engine guards on this), giving plain "1", "2", ….
- > `equation` and `equations` share the `"equation"` counter (36–37); `video` and `youtube` share
  `"video"` (39–40) — an embedded video and a YouTube embed number together.

### The reset table

```
-- environments.ts:46–50 --
export const COUNTER_RESETS: Record<string, string[]> = {
  chapter: ["section"],
  section: ["subsection", "subsubsection", "theorem", "exercise", "problem", "equation", "equations", "figure", "video", "youtube", "audio"],
  subsection: ["subsubsection"],
};
```

- > When a counter advances, every counter named in its reset list goes back to 0. Incrementing
  `section` (48) resets subsections *and* theorems, figures, equations, … — so theorem numbering
  restarts each section (Theorem 1.3 in section 1, then Theorem 2.1 in section 2). A new `chapter` (47)
  resets `section`; the deeper resets cascade because the section reset fires when the section counter
  next moves.

**Invariants & gotchas.**

- A tag absent from `ENVIRONMENTS` is simply not numbered (it gets no `num`). `<toc>`, `<title>`,
  `<ref>` are not in the table.
- The reset list must name every child counter that should restart, including the shared-family ones; a
  forgotten entry means a counter that never restarts.

## Chapter 10 · `numbering.ts` — assigning numbers, filling the registry

**Role.** The generic engine over the Chapter 9 table. It walks the tree once, in document order, and
for each element: if the tag is in `ENVIRONMENTS`, compute and write its `num`; if it has an `id`,
record it in `ctx.registry`. This is the pass that makes "Theorem 1.1" a fact and lets references and
the contents find their targets later.

### Setup and `assign`

```
-- numbering.ts:1–33 --
import type { ElementNode } from "./ast";
import { COUNTER_RESETS, ENVIRONMENTS, type EnvironmentSpec } from "./environments";
import { warn, type CompileContext } from "./context";

/**
 * Walks the document in order assigning LaTeX-style numbers, driven entirely by
 * the ENVIRONMENTS table. The result is written back as a `num` attribute (the
 * emitter ships it to the runtime untouched) and every `id` is recorded in the
 * registry for the reference pass. An author-supplied `num` wins, and re-seats
 * the counter when it is a plain integer.
 */
export function numberDocument(doc: ElementNode, ctx: CompileContext): void {
  const counters: Record<string, number> = {};
  const display: Record<string, string> = {};

  const assign = (el: ElementNode, spec: EnvironmentSpec): void => {
    const explicit = el.attrs.num;
    if (explicit !== undefined) {
      const n = Number(explicit);
      if (Number.isInteger(n) && n >= 0) counters[spec.counter] = n;
      display[spec.counter] = explicit;
    } else {
      const next = (counters[spec.counter] ?? 0) + 1;
      counters[spec.counter] = next;
      const prefix =
        spec.prefixWith && (counters[spec.prefixWith] ?? 0) > 0
          ? `${display[spec.prefixWith]}.`
          : "";
      el.attrs.num = `${prefix}${next}`;
      display[spec.counter] = el.attrs.num;
    }
    for (const reset of COUNTER_RESETS[spec.counter] ?? []) counters[reset] = 0;
  };
```

Two maps hold the running state (13–14): `counters` is the live integer per counter name; `display` is
the *formatted* string per counter (so a child can prepend its parent's "1.2", not just "2").

- > **Explicit number** (17–21): if the author wrote `num="…"`, it wins. If that value is a non-negative
  integer, it also *re-seats* the counter (20) — `num="5"` makes the next sibling 6. Either way the
  display is set to the author's exact string (21), so it may be non-numeric ("A", "1'") and the prefix
  machinery still uses it.
- > **Automatic number** (22–31): bump the counter (23–24); build the prefix from `prefixWith` *only if
  that parent counter is greater than 0* (26) — this is the guard that makes a chapter-less article skip
  the "0." prefix; then write `num` and remember the display (29–30).
- > **Resets** (32): after assigning, zero every child counter named in the reset list. Order matters —
  the element is numbered *before* its children are reset, so the element's own number is final.

### `register`, the walk, and kickoff

```
-- numbering.ts:35–57 --
  const register = (el: ElementNode): void => {
    const id = el.attrs.id;
    if (!id) return;
    if (ctx.registry.has(id)) {
      warn(ctx, `duplicate id "${id}"`, el.pos);
      return;
    }
    ctx.registry.set(id, { tag: el.tag, num: el.attrs.num ?? "" });
  };

  const visit = (el: ElementNode): void => {
    for (const child of el.children) {
      if (child.type !== "element") continue;
      const spec = ENVIRONMENTS[child.tag];
      if (spec) assign(child, spec);
      register(child);
      visit(child);
    }
  };

  register(doc);
  visit(doc);
}
```

- > `register` (35–43): if the element has an `id`, record `{tag, num}` in the registry. A second use of
  the same `id` is a **warning** and is *not* overwritten (38–41), so the first definition wins. Note an
  element can be registered even if it has no number (43, `?? ""`) — a section with an id but, say, an
  explicit empty number, or any id-bearing tag not in the table.
- > `visit` (45–53): the recursion. For each element child, look up its spec; if numbered, `assign`;
  always `register`; then recurse. The crucial ordering inside the loop is **assign → register →
  recurse** (49–51): the number is computed, *then* stored in the registry (so the registry has the
  final number), *then* children are processed. Because the walk is in document order, counters advance
  exactly as a reader would encounter them.
- > The kickoff (55–56) registers the root document itself (so a `<document id="…">` is addressable),
  then visits its children.

**Invariants & gotchas.**

- This pass runs **before** references and toc, which read `ctx.registry`. Reorder it and they resolve
  against an empty map.
- Counter state (`counters`, `display`) is local to one call — so today, numbering restarts per file.
  (Sharing it across files is exactly what the multi-file project model needs — Chapter 19 threads one
  `NumberingState` through every file so the counters continue chapter-to-chapter.)
- An explicit non-integer `num` sets the display but not the counter — useful for "1a" without
  disturbing the sequence.

**Check by hand.** Two sections, the first containing a theorem and a lemma, the second a theorem. What
are the four numbers? *Answer:* §1, Theorem 1.1, Lemma 1.2 (family shares the counter), §2, Theorem 2.1
(the `section` reset zeroed the theorem counter).

## Chapter 11 · `math.ts` — compile-time KaTeX

**Role.** Renders every piece of math to HTML, at compile time, so the browser ships only KaTeX's CSS,
never its (large) JavaScript. It handles the math tags (`<m>`, `<equation>`, `<equations>`) and inline
`$…$` / `$$…$$` in prose, turns `\$` into a literal dollar, and records `ctx.mathUsed`. A LaTeX error is
a *warning* with the source text as fallback — never a failed build. Its output is the only `RawNode`s
the compiler ever makes.

### The walk: math tags vs prose

```
-- math.ts:1–35 --
import katex from "katex";
import { textContent, type ElementNode, type Node, type Position } from "./ast";
import { warn, type CompileContext } from "./context";
import { RAW_TAGS } from "./preprocess";

/** Tags whose content is LaTeX, rendered at compile time. */
const MATH_TAGS = new Set(["m", "math", "equation", "equations"]);

/**
 * Renders all math to HTML at compile time — KaTeX itself never ships to the
 * browser, only its CSS does. Covers MATH_TAGS plus `$…$` / `$$…$$` in prose,
 * and unescapes `\$`. Non-math RAW_TAGS (code) are left untouched. A LaTeX error
 * is a warning, not a build failure: the source text is emitted as fallback.
 */
export function renderMath(doc: ElementNode, ctx: CompileContext): void {
  visit(doc);

  function visit(el: ElementNode): void {
    if (MATH_TAGS.has(el.tag)) {
      const source = textContent(el);
      const latex =
        el.tag === "equations" ? `\\begin{aligned}${source}\\end{aligned}` : source;
      el.children = [render(latex, el.tag !== "m", el.pos)];
      return;
    }
    if (RAW_TAGS.has(el.tag)) return;
    el.children = el.children.flatMap((child): Node[] => {
      if (child.type === "element") {
        visit(child);
        return [child];
      }
      if (child.type === "text") return expandDollars(child.text, el.pos);
      return [child];
    });
  }
```

- > `MATH_TAGS` (7) is the set of tags whose *entire content* is LaTeX. Note it is a subset of
  `preprocess.ts`'s `RAW_TAGS` — `code`/`codeblock` are raw (protected from `$`-scanning) but **not**
  math.
- > **A math tag** (19–24): take its text (`textContent`), wrap `<equations>` in an `aligned`
  environment (21–22) so authors can use `&` and `\\`, then replace the element's children with a single
  rendered node (23). `displayMode` is true for everything except inline `<m>` (`el.tag !== "m"`).
- > **A raw, non-math tag** (26): `return` immediately — do not descend into `<code>`. Its `$` and `<`
  are literal; scanning them for math would corrupt code.
- > **Anything else** (27–34): rebuild its children with `flatMap` (the same splice idiom as includes).
  An element child is visited recursively; a **text** child is handed to `expandDollars`, which may
  split it into several nodes (text + rendered math + text). This is exactly the transformation you saw
  in Chapter 3, step 5.

### Scanning prose for `$…$`

```
-- math.ts:37–74 --
  /** Splits prose into text and rendered `$…$` / `$$…$$` segments. */
  function expandDollars(text: string, pos?: Position): Node[] {
    const nodes: Node[] = [];
    let plain = "";
    let i = 0;
    const flush = (): void => {
      if (plain) nodes.push({ type: "text", text: plain });
      plain = "";
    };

    while (i < text.length) {
      const ch = text[i];
      if (ch === "\\" && text[i + 1] === "$") {
        plain += "$";
        i += 2;
        continue;
      }
      if (ch === "$") {
        const closer = text[i + 1] === "$" ? "$$" : "$";
        const open = i + closer.length;
        const close = findCloser(text, open, closer);
        if (close === -1) {
          warn(ctx, `unbalanced ${closer} — write \\$ for a literal dollar`, pos);
          plain += ch;
          i++;
          continue;
        }
        flush();
        nodes.push(render(text.slice(open, close), closer === "$$", pos));
        i = close + closer.length;
        continue;
      }
      plain += ch;
      i++;
    }
    flush();
    return nodes;
  }
```

`expandDollars` accumulates ordinary characters into `plain` and emits math segments as it meets them.

- > `flush` (42–45) turns the accumulated `plain` into a text node (if non-empty) and clears it. It is
  called right before pushing a math node and once at the end, so the text/math/text ordering is
  preserved.
- > `\$` (49–53) appends a literal `$` and advances past both characters — an escaped dollar never opens
  math. (This is where the `\$` that survived `preprocess` finally becomes a plain `$`.)
- > A real `$` (54–68): decide `$$` vs `$` (55), find the matching closer (57). **Unbalanced** (58–62):
  warn, treat the `$` as a literal character, and continue — a stray dollar degrades gracefully instead
  of swallowing the rest of the paragraph. **Balanced**: `flush` the preceding text, render the slice
  between the delimiters (65), and jump past the closer.
- > Ordinary characters accumulate (69–70); a final `flush` (72) emits any trailing text.

### Rendering, and the escape-aware closer search

```
-- math.ts:76–96 --
  function render(latex: string, displayMode: boolean, pos?: Position): Node {
    ctx.mathUsed = true;
    try {
      return { type: "raw", html: katex.renderToString(latex, { displayMode }) };
    } catch (e) {
      warn(ctx, `KaTeX: ${e instanceof Error ? e.message : String(e)}`, pos);
      return { type: "text", text: latex };
    }
  }
}

function findCloser(text: string, from: number, closer: string): number {
  for (let i = from; i < text.length; i++) {
    if (text[i] === "\\") {
      i++;
      continue;
    }
    if (text.startsWith(closer, i)) return i;
  }
  return -1;
}
```

- > `render` (76–84) is the single point where `ctx.mathUsed` is set (77) — *before* the try, so even a
  failed render still flags that the document has math (the CSS is harmless and the fallback text may
  need it). On success it returns a `RawNode` with KaTeX's HTML (79). On a LaTeX error it **warns and
  falls back** to a plain text node of the source (81–82) — the build proceeds, and the reader sees the
  raw formula rather than a broken page.
- > `findCloser` (87–96) scans for the delimiter but **skips escaped characters** (89–92): a `\$` inside
  a formula does not count as a closer. It returns the index of the closer or `-1`.

**Invariants & gotchas.**

- `RawNode`s exist only here. The emitter prints their `html` unescaped — safe because KaTeX produced
  it, dangerous if you ever route author text through `render`.
- `MATH_TAGS < RAW_TAGS`. A tag that is raw but not math (`code`) is left completely alone (26).
- A math error never fails the build; it warns and shows the source. This matches the project's
  diagnostics-not-exceptions rule.

## Chapter 12 · `references.ts` — the canonical cross-cutting pass

**Role.** Resolves `<ref to="id">` against `ctx.registry`: writes the target's number and kind onto the
ref node and records the id in `ctx.referencedIds`. It is small, but it is the *template* for every
"data about another element" feature (citations, the contents, includes all rhyme with it), so the
CONTRIBUTING guide calls this shape "Shape 2." Read it as the worked example of the registry pattern.

```
-- references.ts:1–35 --
import { elements, type ElementNode } from "./ast";
import { warn, type CompileContext } from "./context";

/**
 * Resolves `<ref to="id">` cross-references against the numbering registry
 * (filled by `numberDocument`). For each ref that resolves, the target's number
 * and kind are written onto the node — the runtime composes the visible label
 * ("Theorem 1.1") from them via `t(kind)`, so it localizes — and the target id is
 * recorded in `ctx.referencedIds` so the emitter snapshots it into a
 * `<template data-delta-pop="id">` for the offline pop-over preview.
 *
 * A ref with no `to`, or one pointing at an unknown id, is a *warning*: the node
 * is left bare and the runtime renders it as inert text (no pop-over).
 */
export function resolveReferences(doc: ElementNode, ctx: CompileContext): void {
  for (const el of elements(doc)) {
    if (el.tag !== "ref") continue;

    const to = el.attrs.to;
    if (!to) {
      warn(ctx, "<ref> without a 'to' attribute", el.pos);
      continue;
    }

    const entry = ctx.registry.get(to);
    if (!entry) {
      warn(ctx, `unresolved ref to "${to}"`, el.pos);
      continue;
    }

    el.attrs.num = entry.num;
    el.attrs.kind = entry.tag;
    ctx.referencedIds.add(to);
  }
}
```

- > Walk every element (16), skip all but `<ref>` (17). The `elements(doc)` generator is the standard
  way a pass finds its tags.
- > **No `to`** (19–23): warn and move on; the ref stays bare.
- > **Unknown target** (25–29): `ctx.registry.get(to)` misses, so warn "unresolved ref" — but again do
  not fail. The runtime will show the ref as plain text.
- > **Resolved** (31–33): copy the target's `num` and `tag` onto the ref as `num` and `kind`, then add
  the id to `referencedIds`. Note the **division of labor**: the compiler ships *data* (`num="1.1"`,
  `kind="theorem"`); it does **not** write the words "Theorem 1.1". The runtime composes that label from
  `kind` via the i18n table (`t("theorem")` → "Theorem" or "Teorema"), so a single resolution localizes
  correctly. That is rule 1 again.
- > `referencedIds` is the *demand signal* for the emitter: only ids that some ref actually points at
  are added, so emit snapshots only those targets into pop-over templates (Chapter 16). An id nobody
  references costs nothing.

**Invariants & gotchas.**

- Runs **after** numbering (needs a full registry) and **after** math is fine (it does not touch text).
- Resolution is data-only; the label and pop-over are the runtime's job — keeping i18n in one place.
- Unresolved/`to`-less refs warn, never throw; the page still builds.

## Chapter 13 · `toc.ts` — the heading tree and auto-slugs

**Role.** When the document contains a `<toc>`, this pass collects the heading tree into `ctx.toc`
(emit ships it as a JSON island for `<delta-toc>` to render) and **auto-assigns slug ids** to headings
that lack one, writing them back onto the nodes so the contents links resolve. If there is no `<toc>`,
it does nothing — and, importantly, mutates no ids.

This chapter covers the single-file `buildToc`. The file also exports a project twin,
`buildProjectToc`, which slugs and collects every file's headings into one book-wide contents when a
`<toc scope="project">` asks for it; it is covered with the rest of the multi-file path in Chapter 19.

### The level table, the gate, and the collection walk

```
-- toc.ts:1–57 --
import { elements, textContent, type ElementNode } from "./ast";
import type { CompileContext } from "./context";

/**
 * Builds the table-of-contents heading tree consumed by `<delta-toc>`. Walks the
 * document in order collecting every `chapter`/`section`/`subsection`/`subsubsection`
 * with its level, number and title; the runtime renders the nested nav and filters
 * by `depth`, so the full tree is always shipped.
 *
 * A heading without an `id` gets a slug derived from its title assigned back to the
 * node, so the TOC link (`#slug`) and the rendered section anchor agree. This only
 * happens when the document actually uses a `<toc>` — no `<toc>`, no id mutation.
 */
const LEVEL: Record<string, number> = {
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
};

export function buildToc(doc: ElementNode, ctx: CompileContext): void {
  let hasToc = false;
  for (const el of elements(doc)) {
    if (el.tag === "toc") {
      hasToc = true;
      break;
    }
  }
  if (!hasToc) return;

  // Existing ids (author + numbered) so generated slugs never collide.
  const used = new Set<string>(ctx.registry.keys());
  let auto = 0;

  for (const el of elements(doc)) {
    const level = LEVEL[el.tag];
    if (level === undefined) continue;

    const titleEl = el.children.find(
      (c): c is ElementNode => c.type === "element" && c.tag === "title",
    );

    let id = el.attrs.id;
    if (!id) {
      id = uniqueSlug(slugify(titleEl ? textContent(titleEl) : "") || `section-${++auto}`, used);
      el.attrs.id = id;
    }
    used.add(id);

    ctx.toc.push({
      level,
      id,
      num: el.attrs.num ?? "",
      title: titleEl ? titleEl.children : [],
    });
  }
}
```

- > `LEVEL` (14–19) maps the four heading tags to depths 1–4. A tag absent from it is not a heading and
  is skipped (37).
- > **The gate** (22–29): scan for a `<toc>` first; if none, return immediately. This is what makes the
  id auto-generation *opt-in* — a document without a contents page is never silently mutated.
- > `used` (32) seeds a set of already-taken ids from the registry keys (every author id and numbered
  id), so a generated slug cannot collide with an existing anchor. `auto` (33) numbers fallback slugs.
- > For each heading (35–37): find its `<title>` child (39–41).
- > **Auto-slug** (43–47): if the heading has no `id`, build one from `slugify(title text)`, falling
  back to `section-N` if the title slugifies to empty, run it through `uniqueSlug`, and **write it back**
  onto the node (46). That write is essential — the rendered section will carry this id as its anchor, so
  the contents link `#slug` lands on it. Then record it in `used` (48).
- > **The entry** (50–55): push `{level, id, num, title}`. Two subtleties: `num` may be `""` for an
  unnumbered heading (53), and `title` is the **child nodes** of the `<title>`, not its text (54) — so a
  heading with inline math keeps it (emit serializes those nodes). This is the deliberate dodge around
  `textContent` dropping `RawNode`s (Chapter 4).

### The slug helpers

```
-- toc.ts:59–74 --
/** GitHub-style slug: lowercase, non-alphanumerics → hyphens, trimmed. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Ensure uniqueness by suffixing `-2`, `-3`, … and record the result in `used`. */
function uniqueSlug(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
```

- > `slugify` (60–66): lowercase, collapse runs of non-alphanumerics to single hyphens, trim leading and
  trailing hyphens. "Background & Motivation" → `background-motivation`.
- > `uniqueSlug` (69–74): if `base` is free, take it; otherwise append `-2`, `-3`, … until one is free.
  (The function name says "record the result," but the recording into `used` happens at the call site,
  line 48.)

**Invariants & gotchas.**

- The full heading tree is collected regardless of depth; the **runtime** filters by the `<toc depth>`
  attribute, so two TOCs with different depths can coexist from one island.
- `title` holds nodes, not text, so heading math survives into the contents.
- No `<toc>` means no work and no id mutation — a deliberate "least surprise" choice.

## Chapter 14 · `figures.ts` & `theme.ts` — inlining local assets

These two passes share a shape: read a local file relative to `dirname(ctx.file)`, fold it into the
output, and treat a missing/remote source as a *warning* (figures) — the offline invariant means the
compiler is the only one who can read files, so it inlines them now or not at all.

### `figures.ts`

**Role.** Replaces a `<figure src="photo.png">`'s `src` with a base64 `data:` URI of the image, so the
picture travels inside the HTML. Missing, remote, or unsupported sources warn and drop the `src` (the
runtime then shows a "missing" note).

```
-- figures.ts:1–23 --
import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { elements, type ElementNode } from "./ast";
import { warn, type CompileContext } from "./context";

/**
 * Inlines `<figure src="…">` images as `data:` URIs so the output stays
 * self-contained (the browser runs offline; only the compiler can read files).
 * The image is resolved relative to the document, base64-encoded, and written
 * back to `src` — the runtime then builds the `<img>` from it. A missing,
 * unsupported, or remote source is a *warning* (the src is dropped, the runtime
 * shows a "missing" note), never a build failure.
 */

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
};
```

- > `MIME` (15–23) maps a file extension to the `data:` URI's media type. An extension not in the map is
  "unsupported."

```
-- figures.ts:25–51 --
export function inlineFigures(doc: ElementNode, ctx: CompileContext): void {
  const base = dirname(ctx.file);
  for (const el of elements(doc)) {
    if (el.tag !== "figure") continue;
    const src = el.attrs.src;
    if (!src || src.startsWith("data:")) continue;

    if (/^[a-z]+:\/\//i.test(src)) {
      warn(ctx, `figure src must be a local path, not a URL: ${src}`, el.pos);
      delete el.attrs.src;
      continue;
    }
    const mime = MIME[extname(src).toLowerCase()];
    if (!mime) {
      warn(ctx, `unsupported image type for figure: ${src}`, el.pos);
      delete el.attrs.src;
      continue;
    }
    try {
      const data = readFileSync(resolve(base, src));
      el.attrs.src = `data:${mime};base64,${data.toString("base64")}`;
    } catch {
      warn(ctx, `figure image not found: ${src}`, el.pos);
      delete el.attrs.src;
    }
  }
}
```

- > `base` (26) is the document's directory — recall the include pass rewrote any sub-directory figure
  `src` to be relative to *this* directory, precisely so this resolution works.
- > Skip non-figures, and figures with no `src` or an already-inlined `data:` src (29–30).
- > **Remote** (32–36): a URL would break the offline output, so warn and drop the `src`.
- > **Unsupported type** (37–42): no MIME match, warn and drop.
- > **Read and inline** (43–48): read the bytes, base64-encode, and write a `data:` URI back into `src`.
  A read failure (missing file) warns and drops. The emitter later copies this `src` onto the
  `<delta-figure>`; the runtime builds an `<img>` from the data URI.

### `theme.ts`

**Role.** Reads the `<document theme="my.css">` file into `ctx.userCss`, which emit inlines *last* so it
overrides the design system. Remote/missing themes warn and drop; a theme that itself references
external resources warns but is still inlined (the author owns that trade-off).

```
-- theme.ts:1–41 --
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ElementNode } from "./ast";
import { warn, type CompileContext } from "./context";

/**
 * Resolves `<document theme="my.css">`: reads the author's stylesheet at compile
 * time and stashes it on `ctx.userCss`, which the emitter inlines as the last
 * (unlayered) `<style>` block so it overrides the design system. The file is
 * resolved relative to the document (like figure images and KaTeX fonts) so the
 * output stays self-contained — never linked. A remote or missing theme is a
 * *warning* (the theme is dropped), never a build failure.
 *
 * The output is meant to reference nothing external; a theme that pulls in an
 * `@import` or a remote `url(…)` would break that, so we warn — but still inline
 * it, leaving the call to the author (we never rewrite their CSS).
 */
const EXTERNAL_REF = /@import|url\(\s*['"]?(?:https?:|\/\/)/i;

export function resolveTheme(doc: ElementNode, ctx: CompileContext): void {
  const themeAttr = doc.attrs.theme;
  if (!themeAttr) return;

  if (/^[a-z]+:\/\//i.test(themeAttr)) {
    warn(ctx, `theme must be a local path, not a URL: ${themeAttr}`, doc.pos);
    return;
  }

  let css: string;
  try {
    css = readFileSync(resolve(dirname(ctx.file), themeAttr), "utf8");
  } catch {
    warn(ctx, `theme file not found: ${themeAttr}`, doc.pos);
    return;
  }

  if (EXTERNAL_REF.test(css)) {
    warn(ctx, `theme '${themeAttr}' references an external resource; output may not work offline`, doc.pos);
  }
  ctx.userCss = css;
}
```

- > `EXTERNAL_REF` (18) is a heuristic that catches `@import` and `url(http…)`/`url(//…)`.
- > Read the `theme` attribute off the **document root** (21–22); no theme, nothing to do.
- > **Remote** theme path (24–27): warn and bail — you cannot link a network stylesheet into an offline
  file.
- > **Read** (29–35): resolve relative to the document and read as text; a failure warns and bails.
- > **External-reference check** (37–39): if the CSS itself pulls in something external, warn — but
  **still inline it** (40). The compiler does not rewrite author CSS; it only flags the offline risk.
- > `ctx.userCss = css` (40) hands the stylesheet to emit, which places it last in the cascade.

**Invariants & gotchas.**

- Both passes resolve relative to `ctx.file`. The include pass's asset rewrite (Chapter 8) is what keeps
  this correct for figures that came from another directory.
- figures *delete* a bad `src` (so the runtime can detect "missing"); theme simply leaves `userCss`
  unset.
- A theme can technically smuggle in an external `url()`; the compiler warns rather than silently
  breaking the offline guarantee, but trusts the author's intent.

## Chapter 15 · `strings.ts` — internationalization (babel)

**Role.** The localization table. It maps each UI key (environment labels, caption words, "Contents")
to a string per language, and provides two helpers: `resolveLang` (normalize `pt-BR` → `pt`) and
`stringsFor` (merge a language over the English base). The compiler picks *which* strings apply; the
**runtime** composes the actual chrome from them via `t(key)`. This is the data half of Delta's "babel."

### The table

```
-- strings.ts:1–64 --
/**
 * Localization table — Delta's `babel`. Auto-generated UI text (environment
 * labels, caption prefixes, structural words) is keyed here by language. The
 * emitter resolves the document's `lang`, inlines `stringsFor(lang)` as the
 * `#delta-i18n` data-island, and the runtime looks each key up via `t()`.
 *
 * Adding a translatable string = a key in every block. Adding a language = a
 * new block; `en` is the base every other language falls back to (`stringsFor`).
 */

const DEFAULT_LANG = "en";

export const STRINGS: Record<string, Record<string, string>> = {
  en: {
    // environment labels (one per ENVIRONMENT_TAGS entry)
    theorem: "Theorem",
    proposition: "Proposition",
    lemma: "Lemma",
    corollary: "Corollary",
    conjecture: "Conjecture",
    definition: "Definition",
    example: "Example",
    claim: "Claim",
    observation: "Observation",
    exercise: "Exercise",
    problem: "Problem",
    proof: "Proof",
    solution: "Solution",
    remark: "Remark",
    // caption prefixes / structural words — seeded for components still to come
    section: "Section",
    equation: "Equation",
    figure: "Figure",
    table: "Table",
    video: "Video",
    audio: "Audio",
    contents: "Contents",
    hint: "Hint",
  },
  pt: {
    theorem: "Teorema",
    proposition: "Proposição",
    lemma: "Lema",
    corollary: "Corolário",
    conjecture: "Conjectura",
    definition: "Definição",
    example: "Exemplo",
    claim: "Afirmação",
    observation: "Observação",
    exercise: "Exercício",
    problem: "Problema",
    proof: "Demonstração",
    solution: "Solução",
    remark: "Comentário",
    section: "Seção",
    equation: "Equação",
    figure: "Figura",
    table: "Tabela",
    video: "Vídeo",
    audio: "Áudio",
    contents: "Sumário",
    hint: "Dica",
  },
};
```

- > `STRINGS` (13–64) is `lang → key → string`. The `en` block (14–39) is both English *and* the
  fallback for every other language. The keys mirror the environment tags (so `t("theorem")` localizes a
  theorem label) plus structural words like `section`, `equation`, `figure`, and `contents` (the TOC
  heading). The `pt` block (40–63) provides Portuguese values for the same keys.
- > The contract in the header comment (7–8) is the maintenance rule: **a new translatable string is a
  key in every block; a new language is a new block.** Miss a key in `pt` and that one label falls back
  to English (see `stringsFor`).

### The two resolvers

```
-- strings.ts:66–80 --
/** Normalize a `lang` to a key present in STRINGS: `pt-BR` → `pt`, unknown → `en`. */
export function resolveLang(lang?: string): string {
  if (!lang) return DEFAULT_LANG;
  const lower = lang.toLowerCase();
  if (STRINGS[lower]) return lower;
  const base = lower.split("-")[0];
  if (STRINGS[base]) return base;
  return DEFAULT_LANG;
}

/** Merged string set for a resolved language — `en` base overlaid by the language,
 *  so any key a language omits falls back to English. Pass a `resolveLang` result. */
export function stringsFor(lang: string): Record<string, string> {
  return { ...STRINGS[DEFAULT_LANG], ...(STRINGS[lang] ?? {}) };
}
```

- > `resolveLang` (67–74): no lang → English; an exact match (`"pt"`) wins; otherwise try the base
  subtag (`"pt-BR"` → `"pt"`, 71–72); failing all that, English. So `<document lang="pt-BR">` resolves to
  the `pt` block, and an unknown language degrades to English rather than erroring.
- > `stringsFor` (78–80): spread the English base, then overlay the chosen language (79). Because the
  language overlays English, any key the language omits keeps its English value — the fallback is
  automatic. The emitter calls `stringsFor(resolveLang(ctx.lang))` and inlines the result as the
  `#delta-i18n` JSON island.

**Invariants & gotchas.**

- The compiler ships *data* (the resolved string table); the runtime's `t(key)` composes the visible
  label. References, environments, captions, and the contents all read these same strings, so a
  document's language is consistent everywhere.
- English is both a language and the universal fallback — never delete an `en` key.

# Part V — Producing the output

The tree is now fully resolved: numbers, math, references, contents, and assets are all in place. The
last pass turns it into the single HTML file, and the orchestrator (read last) shows how the whole line
fits together.

## Chapter 16 · `emit.ts` & `katex-css.ts` — serialization and the final HTML

**Role of `emit.ts`.** The terminal pass. It assembles the `<head>` (inlined CSS in cascade order, plus
the KaTeX CSS if needed), serializes the tree to HTML with every tag renamed `delta-…`, appends the
pop-over `<template>`s and the two JSON islands (`#delta-toc`, `#delta-i18n`), and inlines the runtime.
Out comes the standalone document. It is the one place that decides the *byte order* of the output, and
the one place that enforces escaping.

### The `emit` function: head, body, islands, skeleton

```
-- emit.ts:1–65 --
import { basename } from "node:path";
import { elements, textContent, type ElementNode, type Node } from "./ast";
import type { CompileContext } from "./context";
import { katexCss } from "./katex-css";
import { resolveLang, stringsFor } from "./strings";
import { CORE_CSS, RUNTIME_JS, THEMES } from "../generated/assets";

const DEFAULT_TYPE = "article";

/**
 * Serializes the AST into one standalone HTML file. Every tag becomes
 * `<delta-tag>` — the compiler ships data (num attributes, ids, pre-rendered
 * math) and the inlined runtime renders the chrome. All CSS/JS/fonts are
 * inlined; the output must reference no external resources (guarded by
 * test/emit.test.ts). KaTeX CSS is included only when math was rendered.
 */
export function emit(doc: ElementNode, ctx: CompileContext): string {
  const titleEl = doc.children.find(
    (c): c is ElementNode => c.type === "element" && c.tag === "title",
  );
  const title = titleEl ? textContent(titleEl).trim() : basename(ctx.file).replace(/\.dlt$/, "");

  // `type` selects the @layer delta.theme overrides (article is the default).
  const type = doc.attrs.type ?? DEFAULT_TYPE;
  const themeCss = THEMES[type] ?? THEMES[DEFAULT_TYPE];

  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeText(title)}</title>`,
    `<style>\n${CORE_CSS}\n</style>`,
    ...(themeCss ? [`<style>\n${themeCss}\n</style>`] : []),
    ...(ctx.mathUsed ? [`<style>\n${katexCss()}\n</style>`] : []),
    // Author theme (<document theme>) goes last and unlayered, so it overrides
    // the design system, the per-type theme layer, and even the inlined KaTeX CSS.
    ...(ctx.userCss ? [`<style>\n${ctx.userCss}\n</style>`] : []),
  ].join("\n");

  // Localized UI strings for the document's language, inlined as an inert data
  // island the runtime reads via t(). `<` is escaped so a string can't break out
  // of the </script>.
  const i18n = JSON.stringify(stringsFor(resolveLang(ctx.lang))).replace(/</g, "\\u003c");

  const body = serialize(doc);
  // Snapshot every <ref> target into an inert <template> so the runtime can clone
  // it into a pop-over preview without a fetch. Only referenced ids are emitted.
  const templates = renderTemplates(doc, ctx);
  // Heading tree for <delta-toc>, shipped as an inert JSON island.
  const toc = renderTocIsland(ctx);

  return `<!DOCTYPE html>
<html lang="${escapeAttr(ctx.lang)}">
<head>
${head}
</head>
<body>
${body}
${templates}${toc}<script type="application/json" id="delta-i18n">${i18n}</script>
<script>
${RUNTIME_JS}
</script>
</body>
</html>
`;
}
```

The imports tell the story: `CORE_CSS`, `RUNTIME_JS`, `THEMES` come from `../generated/assets` (6) — a
build artifact, produced by `scripts/build.ts`, that bundles the runtime to an IIFE string and
concatenates the stylesheets. The emitter just *inlines* those strings; it does not build them.

- > **Title** (18–21): the document's own `<title>`'s text, trimmed; or the filename without `.dlt` if
  there is none.
- > **Type and theme** (24–25): `<document type>` selects a `@layer delta.theme` override block from
  `THEMES` (default `article`). This is the per-document-type theme, distinct from a user `theme=` file.
- > **The `<head>` cascade order** (27–37) is deliberate and load-bearing for theming:
  1. `CORE_CSS` (31) — base + components, which declare the `@layer` order;
  2. the type theme (32) — overrides in `@layer delta.theme`, which beats base/components;
  3. KaTeX CSS (33) — **only if `ctx.mathUsed`** (this is the megabyte the math pass gated);
  4. the author's `userCss` (36) — **last and unlayered**, so it overrides everything, even KaTeX.
  Each is an array spread that contributes zero or one `<style>` block.
- > **The i18n island** (42): the resolved string table, JSON-encoded, with `<` escaped to `<` so a
  string value can never contain a literal `</script>` that ends the island early. The same trick
  guards the TOC island.
- > **Body and islands** (44–49): serialize the tree, then build the pop-over templates and the TOC
  island.
- > **The skeleton** (51–64): a fixed HTML document. Note the ordering inside `<body>`: the content
  first, then `${templates}${toc}` then the i18n island, then the runtime `<script>` **last**. The
  runtime sitting at the end of `<body>` matters — by the time it runs, the whole tree (and the islands
  it reads) is already parsed, so custom elements upgrade with their data present.

### `renderTemplates` — snapshot only what is referenced

```
-- emit.ts:67–86 --
/**
 * Builds an inert `<template data-delta-pop="id">…</template>` for every target a
 * `<ref>` resolved to (recorded in `ctx.referencedIds`). The id→node map is built
 * in a single walk; the runtime clones a template into the pop-over preview, so no
 * fetch is needed. Returns "" when nothing is referenced.
 */
function renderTemplates(doc: ElementNode, ctx: CompileContext): string {
  if (ctx.referencedIds.size === 0) return "";
  const byId = new Map<string, ElementNode>();
  for (const el of elements(doc)) {
    const id = el.attrs.id;
    if (id && !byId.has(id)) byId.set(id, el);
  }
  const out: string[] = [];
  for (const id of ctx.referencedIds) {
    const node = byId.get(id);
    if (node) out.push(`<template data-delta-pop="${escapeAttr(id)}">${serialize(node)}</template>`);
  }
  return out.length ? out.join("\n") + "\n" : "";
}
```

- > Early return if nothing was referenced (74) — most of the demand-driven design lives in this line:
  no references, no templates, no cost.
- > Build an `id → node` map in one walk (75–79; first definition wins on duplicates).
- > For each **referenced** id, serialize that node into a `<template data-delta-pop="id">` (80–84). A
  `<template>` is inert in the DOM — it costs nothing until the runtime clones it into a pop-over. This
  is how a `<ref>` shows a preview of its target *with no fetch*: the target's HTML is already on the
  page, hidden in a template.

### `renderTocIsland` — the contents as JSON

```
-- emit.ts:88–103 --
/**
 * Serializes the TOC heading tree into an inert JSON island the runtime reads.
 * Each title's inline children are serialized so math/emphasis survive. `<` is
 * escaped so a title can't break out of the </script>. Empty when no `<toc>` ran.
 */
function renderTocIsland(ctx: CompileContext): string {
  if (ctx.toc.length === 0) return "";
  const data = ctx.toc.map((e) => ({
    level: e.level,
    id: e.id,
    num: e.num,
    title: e.title.map(serialize).join(""),
  }));
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/json" id="delta-toc">${json}</script>\n`;
}
```

- > Empty if `buildToc` produced nothing (94).
- > Map each `TocEntry` to a plain JSON object (95–100). Crucially, `title` — which is an array of
  *nodes* — is **serialized to HTML** here (99), the same serializer the body uses. That is why heading
  math reaches the contents: the nodes were preserved through `buildToc`, and turned to HTML only now.
- > Encode and escape `<` (101), wrap in the `#delta-toc` island (102). The runtime parses this, filters
  by `depth`, and builds the nested nav.

### `serialize` and the escapers — the heart of output

```
-- emit.ts:105–128 --
function serialize(node: Node): string {
  switch (node.type) {
    case "text":
      return escapeText(node.text);
    case "raw":
      return node.html;
    case "element": {
      const tag = `delta-${node.tag}`;
      const attrs = Object.entries(node.attrs)
        .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
        .join("");
      // Custom elements cannot self-close in HTML; always emit an explicit close tag.
      return `<${tag}${attrs}>${node.children.map(serialize).join("")}</${tag}>`;
    }
  }
}

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}
```

`serialize` is a recursive walk that turns a node into an HTML string — and it is where rule 1 becomes
literal output:

- > **Text** (107–108): escaped (so author `<`/`&`/`>` cannot inject markup).
- > **Raw** (109–110): emitted **unescaped** — this is KaTeX HTML, the one trusted string (Chapter 4).
- > **Element** (111–118): rename the tag with a `delta-` prefix (112) — `theorem` becomes
  `<delta-theorem>` — serialize the attributes (113–115, each escaped), then recurse into children and
  always emit an **explicit close tag** (117), because HTML custom elements may not self-close. Every
  resolved datum — `num`, `kind`, the inlined figure `src` — rides out here as an attribute on the
  `<delta-*>` element, which is exactly what the runtime reads.
- > The two escapers (122–128): `escapeText` handles `&`/`<`/`>` (in that order — `&` first, so it does
  not double-escape the entities it introduces); `escapeAttr` adds `"`. Together they keep author
  content from breaking the markup.

### `katex-css.ts` — fonts as `data:` URIs

**Role.** Produces KaTeX's stylesheet with its woff2 fonts embedded as `data:` URIs, so math renders
offline. Called by `emit` only when `ctx.mathUsed`. Memoized, because it is large and identical each
time.

```
-- katex-css.ts:1–25 --
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

let cached: string | undefined;

/**
 * KaTeX's stylesheet with every woff2 font embedded as a `data:` URI and the
 * woff/ttf fallbacks dropped. This is what makes math render offline from
 * `file://` — the output may reference no external resources.
 */
export function katexCss(): string {
  if (cached !== undefined) return cached;
  const cssPath = require.resolve("katex/dist/katex.min.css");
  const css = readFileSync(cssPath, "utf8");
  cached = css.replace(/src:[^;}]*/g, (src) => {
    const woff2 = /url\((fonts\/[^)]+\.woff2)\)/.exec(src);
    if (!woff2) return src;
    const data = readFileSync(join(dirname(cssPath), woff2[1])).toString("base64");
    return `src:url(data:font/woff2;base64,${data}) format("woff2")`;
  });
  return cached;
}
```

- > `cached` (7, 15) memoizes the (expensive, ~1 MB) result; the first call builds it, the rest reuse it.
- > Locate KaTeX's CSS via `require.resolve` (16) — it reads the file straight out of `node_modules`.
- > The `replace` (18–23) rewrites each `src:` declaration: find a woff2 `url(fonts/…)` (19), read that
  font file and base64-encode it (21), and replace the whole `src:` with a single
  `url(data:font/woff2;base64,…)` — **dropping the woff/ttf fallbacks** (a `src:` with no woff2 is left
  unchanged at line 20). The result references no font files; it carries them.

**Invariants & gotchas.**

- The `<head>` cascade order (CORE → type theme → KaTeX → user theme) *is* the theming model; reordering
  it changes who wins.
- `serialize` escapes everything except `RawNode.html`. That single exception is the trust boundary.
- Both JSON islands escape `<` to `<` to prevent `</script>` breakout — a small but essential
  safety detail.
- KaTeX CSS and the runtime come from `../generated/assets`, which is git-ignored and regenerated by the
  build; the emitter assumes it exists.

## Chapter 17 · `index.ts` — the orchestrator, read last

**Role.** Defines `compileSource` (the pass order) and `compileFile` (read a file, compile, return
result + diagnostics). Having read every pass, this file should now contain no surprises — it is the
table of contents made executable.

### `compileSource` — the pipeline in order

```
-- index.ts:1–48 --
import { readFileSync } from "node:fs";
import { createContext, error, hasErrors, type CompileContext, type Diagnostic } from "./context";
import { emit } from "./emit";
import { inlineFigures } from "./figures";
import { resolveIncludes } from "./include";
import { renderMath } from "./math";
import { numberDocument } from "./numbering";
import { parse } from "./parse";
import { preprocess } from "./preprocess";
import { resolveReferences } from "./references";
import { resolveTheme } from "./theme";
import { buildToc } from "./toc";
import { resolveImports } from "./imports";
import { loadBibliography, resolveCitations } from "./bibliography";

export interface CompileResult {
  html?: string; // Only present if compilation succeeded.
  diagnostics: Diagnostic[];
}

/**
 * The pipeline: preprocess → parse → includes → bibliography → citations → number → math →
 * references → toc → inline figures → resolve theme → imports → emit. Pass order is load-bearing —
 * includes merge first so everything downstream sees one tree, the bibliography splices cited papers
 * before numbering/math process them, numbering fills the registry that later passes (references, toc)
 * read, and the emitter always runs last.
 */
export function compileSource(source: string, ctx: CompileContext): string | undefined {
  const doc = parse(preprocess(source), ctx);
  if (!doc || hasErrors(ctx)) return undefined;
  resolveIncludes(doc, ctx); // splice <include> files into one tree (before numbering)
  if (hasErrors(ctx)) return undefined; // a missing/cyclic include fails the build
  // Parse and processes successfully, but may have non-fatal diagnostics. Continue to emit, but report
  ctx.lang = doc.attrs.lang ?? "en"; // drives i18n + <html lang>; read by emit and later passes
  // Bibliography runs before numbering so the cited papers it splices flow through the
  // normal passes (numbering skips them; math then renders any math in their fields).
  loadBibliography(doc, ctx); // build the paper registry; empty the <bibliography>
  resolveCitations(doc, ctx); // number <cite>; fill <bibliography> with cited papers
  // Numbering must run before math, since math needs the registry to resolve labels.
  numberDocument(doc, ctx);
  renderMath(doc, ctx);
  resolveReferences(doc, ctx); // resolve <ref to>; mark targets for snapshotting
  buildToc(doc, ctx); // collect the heading tree (+ auto-slug ids) if a <toc> is present
  inlineFigures(doc, ctx); // read figure images and embed them as data: URIs
  resolveTheme(doc, ctx); // read <document theme> CSS; emit inlines it last
  resolveImports(doc, ctx);
  return emit(doc, ctx);
}
```

- > The imports (1–14) are the entire compiler in one view: one per pass, in roughly pipeline order.
- > `CompileResult` (16–19): an optional `html` (absent on failure) plus the diagnostics list — the
  shape the CLI consumes.
- > `compileSource` (28–48) is the pipeline, line for line:
  - **preprocess + parse** (29): escape, then build the tree. If parse failed or any error was recorded,
    bail with `undefined` (30).
  - **resolveIncludes** (31), then a **second `hasErrors` check** (32): includes can fail the build
    (missing/cyclic), so we re-check before doing more work. This is the only mid-pipeline abort, and it
    exists because include errors are fatal where most pass problems are warnings.
  - **lang** (34): read the document language now; numbering and emit will need it.
  - **loadBibliography → resolveCitations** (37–38): run *before* numbering so the cited `<paper>`
    nodes the citation pass splices into the `<bibliography>` flow through numbering (which skips them)
    and math (which renders any math in their fields) like any other node.
  - **numberDocument → renderMath → resolveReferences → buildToc → inlineFigures → resolveTheme →
    resolveImports** (40–46): the data passes, in the order their dependencies demand. The comment at 39
    records the one hard constraint to remember: numbering before everything that reads the registry.
    The load-bearing edges are *includes first*, *bibliography before numbering*, *numbering before
    references/toc*, and *emit last*.
  - **emit** (47): the terminal pass returns the HTML string.
- > Notice what `compileSource` does **not** do: it never throws, never reads a file (the source is
  passed in), and never inspects diagnostics beyond the two `hasErrors` gates. It is a pure-ish sequence
  over the shared context.

### `compileFile` — the thin file wrapper

```
-- index.ts:50–61 --
export function compileFile(path: string): CompileResult {
  const ctx = createContext(path);
  let source: string;
  try {
    source = readFileSync(path, "utf8");
  } catch (e) {
    error(ctx, e instanceof Error ? e.message : String(e));
    return { diagnostics: ctx.diagnostics };
  }
  const html = compileSource(source, ctx);
  return { html, diagnostics: ctx.diagnostics };
}
```

- > Create the context with the file path (51) — recall `ctx.file` is both the diagnostic origin and the
  base for relative paths.
- > Read the file; a read failure is recorded as an error and returned with no `html` (53–58).
- > Otherwise compile and return `{ html, diagnostics }` (59–60). The CLI (`src/cli.ts`) calls this for a
  single file, prints diagnostics, and writes `html` to disk if present; the multi-file entry is Part VI.

**Invariants & gotchas.**

- Pass order is the contract this file encodes. The two `hasErrors` gates (after parse, after includes)
  are the only places compilation aborts early; every other problem is a warning carried to the end.
- `compileSource` takes a *string*, which is why tests (and the include pass) can drive it without
  touching the filesystem; `compileFile` is the filesystem entry point for the *single-file* path. The
  *project* path (`compileProject`, Part VI) is the other one.

This is the whole single-file compiler: one `.dlt` in, one standalone `.html` out. **Part VI** scales
it sideways — many files compiled as *one* numbered work, sharing a registry so a cross-reference can
point into a sibling file. After that, the output crosses into the browser, where the `<delta-*>`
elements you saw `serialize` produce become real chrome — the runtime, and another book.

# Part VI — Multi-file projects

Everything so far compiles **one** document. But a textbook is many chapters, and you want
`Theorem 4.2` to keep counting from chapter 3, a `<ref>` in chapter 5 to resolve a label defined in
chapter 1, and one shared bibliography. Delta's *project* path does this: many `.dlt` inputs become
many standalone `.html` outputs that nonetheless behave as a single numbered work.

The trick is not new machinery but **shared state**. The same passes from Parts III–V run, but the
registry, the paper database and the citation list are *shared* across files, numbering is threaded
through them with one counter state, and emit is deferred until every file is processed — so when a
reference points across files, the target's rendered copy can ship into the output that needs it (no
`fetch`; the offline invariant of Appendix B still holds). Two files hold this: `config.ts` (what to
build) and `project.ts` (how).

## Chapter 18 · `config.ts` — the project file (`project.toml`)

**Role.** Turns a `project.toml` into a `ProjectConfig`: the ordered list of input files and the output
directory, both as absolute paths. It is pure validation and path resolution — it reads no `.dlt`,
runs no pass. Any problem is an `error` diagnostic on the toml.

### The resolved shape

```
-- config.ts:11–21 --
export interface ProjectConfig {
  /** Absolute paths to the input `.dlt` files, in declaration order. */
  inputs: string[];
  /** Absolute path to the output directory (flat — one `<basename>.html` each). */
  outDir: string;
}

export interface ConfigResult {
  config?: ProjectConfig;
  diagnostics: Diagnostic[];
}
```

- > `ProjectConfig` is deliberately tiny: an ordered `inputs` list and one `outDir`. Order matters —
  it fixes numbering and citation sequence across the project (Chapter 19).
- > `ConfigResult` mirrors `CompileResult`: an optional payload plus diagnostics. No config means the
  toml was invalid, and the diagnostics say why.

### Reading and validating the toml

```
-- config.ts:33–75 --
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

  const base = dirname(tomlPath);
  return {
    diagnostics,
    config: {
      inputs: (inputs as string[]).map((i) => resolve(base, i)),
      outDir: resolve(base, (table.out as string | undefined) ?? "."),
    },
  };
}
```

The schema is two keys:

```
inputs = ["intro.dlt", "ch1.dlt"]   # ordered, required, relative to the toml
out    = "dist"                      # output directory, optional (default ".")
```

- > `fail` is a one-liner that pushes an `error` and returns early — every validation branch funnels
  through it, so the function reads as a cascade of guards.
- > The guards, in order: **file missing** (read throws), **invalid TOML** (smol-toml's `parse` throws
  a `TomlError` carrying `line`/`column`, which we fold into the message), **`inputs` absent/empty/not
  an array**, **`inputs` entries not all strings**, **`out` present but not a string**. The first
  failure wins; anything past it is unreachable.
- > Resolution is **relative to the toml's own directory** (`base = dirname(tomlPath)`), and both
  `inputs` and `outDir` come out absolute — so the rest of the compiler never thinks about the toml's
  location again. `out` defaults to `"."`.
- > What `config.ts` deliberately does *not* do: it sets no document `type`, `lang` or `theme`. **Each
  `.dlt` keeps declaring its own** on its `<document>`; the project file only says *which* files and
  *where* the output goes. The toml wires the work together; it does not style it.

## Chapter 19 · `project.ts` — compiling many files as one work

**Role.** `compileProject(config)` runs the single-file pipeline across every input, but threads
*shared* state so the files behave as one numbered work, and defers emit so cross-file references can
ship a local copy of their target. It returns one `{ path, html }` per input.

```
-- project.ts:27–36 --
export interface ProjectResult {
  /** One per input, in declaration order; written verbatim by the CLI. */
  outputs: { path: string; html: string }[];
  diagnostics: Diagnostic[];
}

/** Flat output name for an input: `chapters/01.dlt` → `01.html`. */
export function outNameFor(input: string): string {
  return basename(input).replace(/\.dlt$/, "") + ".html";
}
```

- > Outputs are **flat**: `chapters/01.dlt` and `intro/01.dlt` both want `01.html`. That collision is
  caught up front (below), because the registry that makes cross-file links work assumes one output per
  basename.

### What is shared, and what is not

```
-- project.ts:50–52 --
  const registry = new Map<string, LabelEntry>();
  const papers = new Map<string, ElementNode>();
  const citedPapers: string[] = [];
```

- > These three are created **once** and handed to every file's context. The `registry` (Chapter 10)
  spanning all files is what lets `<ref to="thm:pyth">` in chapter 5 resolve a theorem numbered in
  chapter 1; the shared `papers` + `citedPapers` (the bibliography's data) make one citation sequence
  across the whole work.
- > `referencedIds` is the one piece that stays **per file**: each output should snapshot only the
  targets *it* points at, not every referenced id in the project. (Appendix A's matrix notes this.)

### The five phases

`compileProject` is a straight sequence of five phases over the file set. The ordering is the same
load-bearing logic as `compileSource`, lifted to operate on all files at once.

```
-- project.ts:74–99 (Phase 1, abridged) --
  const files: { ctx: CompileContext; doc: ElementNode; outName: string }[] = [];
  for (const input of config.inputs) {
    const ctx = createContext(input);
    ctx.registry = registry;
    ctx.papers = papers;
    ctx.citedPapers = citedPapers;
    ctx.outName = outNameFor(input);
    ctxs.push(ctx);
    // … read the file, preprocess, parse, resolveIncludes …
    files.push({ ctx, doc, outName: ctx.outName });
  }
  if (ctxs.some(hasErrors)) return { outputs: [], diagnostics: gather() };
```

- > **Phase 0 (the guard).** Before any of this, a loop maps each input to its `outNameFor` and records
  a duplicate-basename collision as an `error`; if any collide, the project bails. Flat layout, so two
  files cannot both own `01.html`.
- > **Phase 1 — read, parse, include.** Each file gets *its own* `ctx` (so diagnostics stay attributed
  to the right file) with the three shared maps swapped in and `outName`/`lang` set. A missing file,
  parse error, or bad `<include>` fails the **whole** project — partial output would have wrong numbers.
- > **Phase 2 — bibliography & citations, project-wide.** `loadBibliography` runs for every file (all
  papers land in the shared `papers`), then `numberCitations` for every file (cites number in
  first-appearance order *across* files). Exactly one `<bibliography>` renders the list — the first file
  (in input order) that has one; `fillBibliography` fills it, extras warn, and cites with no
  bibliography anywhere warn. (Single-file `resolveCitations`, Appendix A, is just these two halves run
  back-to-back; the project splits them so numbering spans all files before any list is filled.)

```
-- project.ts:122–139 (Phase 3 — numbering + id maps) --
  const numState = freshNumbering();
  for (const f of files) numberDocument(f.doc, f.ctx, numState);

  const globalById = new Map<string, ElementNode>();
  const idToFile = new Map<string, string>(); // id → home output name
  for (const f of files) {
    for (const el of elements(f.doc)) {
      const id = el.attrs.id;
      if (id && !globalById.has(id)) {
        globalById.set(id, el);
        idToFile.set(id, f.outName);
      }
    }
  }
```

- > **Phase 3 — shared numbering.** One `freshNumbering()` state is threaded through the files *in
  order* — this is the payoff of the hook Chapter 10 left: passing the same `NumberingState` to each
  `numberDocument` makes the theorem counter continue chapter-to-chapter, all into the one shared
  registry. Then, node identities being stable after numbering and the bibliography fill, two project
  maps are built once: `globalById` (id → node, for snapshots) and `idToFile` (id → its home output).
- > **Phase 4 — the rest of the pipeline, ordered for cross-file capture.** `renderMath` runs for
  **every** file first (so a snapshot taken later carries rendered KaTeX, not source); then
  `buildProjectToc` — the project twin of Chapter 13's `buildToc` — builds one book-wide contents when
  any file asks for `<toc scope="project">`; then per file: `resolveReferences`, the two cross-file
  annotators (below), `inlineFigures`, `resolveTheme`, `resolveImports`.
- > **Phase 5 — emit.** Each file is emitted with `emit(f.doc, f.ctx, globalById)`. The extra argument
  is the whole point: `globalById` spans every file, so when this output references a target living in
  another file, emit can still snapshot that target's rendered copy into *this* page's
  `<template data-delta-pop>` (Chapter 16). The pop-over works offline; only the *jump* crosses files.

### Cross-file links

A same-file reference scrolls in place; a cross-file one must navigate to another HTML file. Two small
passes annotate the difference, read by the runtime:

```
-- project.ts:178–199 --
function annotateCrossFileRefs(
  doc: ElementNode,
  outName: string,
  idToFile: Map<string, string>,
): void {
  for (const el of elements(doc)) {
    if (!REF_TAGS.has(el.tag)) continue;
    if (el.attrs["data-target-num"] === undefined) continue; // unresolved: leave bare
    const to = el.tag === "ref" ? el.attrs.to : el.attrs.of;
    const home = to ? idToFile.get(to) : undefined;
    if (home && home !== outName) el.attrs["data-target-href"] = `${home}#${to}`;
  }
}

/** Records the references list's output on each resolved `<cite>` in another file. */
function annotateCrossFileCites(doc: ElementNode, bibOut: string): void {
  for (const el of elements(doc)) {
    if (el.tag !== "cite") continue;
    if (el.attrs["data-cite-nums"] === undefined) continue; // unresolved: leave inert
    el.attrs["data-cite-file"] = bibOut;
  }
}
```

- > `annotateCrossFileRefs` looks at every resolved `<ref>`/`<solution>`/`<proof>` (the `REF_TAGS` set
  from Chapter 12; `ref` keys off `to`, the others off `of`). If the target's home output differs from
  this file's, it writes `data-target-href="<file>#<id>"`. Same-file refs are left bare — the runtime
  scrolls in page. Unresolved refs (no `data-target-num`) are skipped so a broken link stays inert.
- > `annotateCrossFileCites` does the same for `<cite>`: when the single rendered references list lives
  in another output, it stamps `data-cite-file` with that output's name. The runtime navigates there
  and flashes the entry on arrival (Appendix B's no-fetch rule again — the hovercard copy already shipped
  via `globalById`).

### Entering from the CLI

`src/cli.ts` chooses among three forms of `delta build`:

```
delta build doc.dlt [-o out.html]            # single file  → compileFile
delta build a.dlt b.dlt … [-o out-dir]       # several files → compileProject
delta build project.toml [-o out-dir]        # project file  → loadProjectConfig → compileProject
```

- > A positional `.toml` (or `--project <f>`) is loaded by `config.ts` and compiled by
  `compileProject`. Several positional `.dlt` files are assembled into an ad-hoc
  `ProjectConfig` directly (`{ inputs, outDir }`) — no toml needed. A single `.dlt` keeps the
  unchanged single-file path through `compileFile` (Chapter 17).
- > `-o` overrides the destination: for a project it replaces `outDir` (the toml's `out`); for a single
  file it is the output path. The project writer creates output directories as needed and writes each
  `{ path, html }` verbatim.

**Invariants & gotchas.**

- Numbering, citation order and the choice of which `<bibliography>` renders all depend on **input
  order** in `inputs` — reorder the toml and the numbers move.
- Cross-file pop-overs ship a *copy* of the target into each referencing output via `globalById`; the
  output therefore stays self-contained and offline (Appendix B), at the cost of some duplication.
- A single-file build (`compileFile`) and a project build (`compileProject`) share every pass but differ
  in two places only: numbering takes a shared `NumberingState`, and `emit` takes a `globalById`. Hold
  those two differences in mind and the project path is just the single-file pipeline run N times.

# Appendices

## Appendix A · The complete pass order and the `CompileContext` field matrix

**The passes, in order** (from `compileSource`, Chapter 17):

| # | Pass | File | In → out | Key effect |
|---|------|------|----------|------------|
| 1 | `preprocess` | preprocess.ts | string → string | escape `< > &` inside math / raw tags |
| 2 | `parse` | parse.ts | string → tree | strict XML → generic AST (or `null`) |
| 3 | `resolveIncludes` | include.ts | tree → tree | splice `<include>` files in; cycle detection |
| 4 | `loadBibliography` | bibliography.ts | tree → tree | build `papers` from `<paper>`/`.ref`; empty `<bibliography>` |
| 5 | `resolveCitations` | bibliography.ts | tree → tree | number `<cite>` (`citedPapers`); refill `<bibliography>` |
| 6 | `numberDocument` | numbering.ts | tree → tree | write `num`; fill `registry` |
| 7 | `renderMath` | math.ts | tree → tree | `$…$`/`<m>` → KaTeX `RawNode`; set `mathUsed` |
| 8 | `resolveReferences` | references.ts | tree → tree | `<ref>` → `num`+`kind`; fill `referencedIds` |
| 9 | `buildToc` | toc.ts | tree → tree | fill `toc`; auto-slug heading ids |
| 10 | `inlineFigures` | figures.ts | tree → tree | `<figure src>` → `data:` URI |
| 11 | `resolveTheme` | theme.ts | tree → tree | read `theme=` CSS → `userCss` |
| 12 | `resolveImports` | imports.ts | tree → tree | read `<import>` packs → `imports`; strip the nodes |
| 13 | `emit` | emit.ts | tree → string | rename to `<delta-*>`, assemble the HTML |

The single-file `compileSource` runs these in order. The multi-file `compileProject`
(`project.ts`) runs the same passes but threads shared state across files (one
`NumberingState`, a shared `registry`/`papers`/`citedPapers`) and defers `emit` until
every file's math is rendered — see Chapter 19.

**Who writes / who reads each `CompileContext` field:**

| Field | Written by | Read by |
|-------|-----------|---------|
| `file` | `createContext` (and temporarily swapped by `resolveIncludes`) | figures/theme/include/imports (relative-path base), emit (title fallback), every `error`/`warn` |
| `outName` | `compileProject` (project path only) | `emit` (the output file name; cross-file link targets) |
| `diagnostics` | `error` / `warn` (any pass) | the CLI |
| `registry` | `numberDocument` | `resolveReferences`, `buildToc` (seeds the slug `used` set) |
| `papers` | `loadBibliography` | `resolveCitations`, `buildToc` (seeds the slug `used` set), `emit` (cross-file snapshots) |
| `citedPapers` | `resolveCitations` | `resolveCitations` (the running number); shared across files on the project path |
| `referencedIds` | `resolveReferences` **and** `resolveCitations` (cited papers snapshot too) | `emit` (`renderTemplates`) |
| `toc` | `buildToc` | `emit` (`renderTocIsland`) |
| `mathUsed` | `renderMath` | `emit` (gates the KaTeX `<style>`) |
| `lang` | `compileSource` (from `<document lang>`) | `emit` (`<html lang>` and the i18n island) |
| `userCss` | `resolveTheme` | `emit` (the last `<style>`) |
| `imports` | `resolveImports` | `emit` (pack JS after the runtime, pack CSS before the theme) |

The matrix is the proof that pass order is load-bearing: every "read by" must come after its "written
by." Numbering (writer of `registry`) precedes references and toc (readers); the math pass (writer of
`mathUsed`) precedes emit (reader); includes (which mutate the tree wholesale) run before all of them;
and the bibliography passes splice the cited `<paper>` nodes *before* numbering, so those papers flow
through numbering and math like any other node.

## Appendix B · The "no external resources" invariant

Rule 2 — *the output references nothing external* — is upheld by several passes acting in concert, and
checked by one test.

**Who upholds it:**

- `katex-css.ts` embeds woff2 fonts as `data:` URIs, so the math stylesheet links to no font files.
- `figures.ts` turns local images into `data:` URIs and *drops* a remote or missing `src`.
- `include.ts` refuses a URL `src` (you cannot inline a network file) and rewrites relative asset paths
  so they still resolve after merging.
- `theme.ts` refuses a remote theme path and *warns* if the CSS itself imports something external.
- `emit.ts` inlines `CORE_CSS`, the type theme, KaTeX CSS, the user theme, and the runtime as text — no
  `<link>`, no `<script src>`.

**Who checks it:** `test/emit.test.ts` contains a "references no external resources" test that compiles
a document and asserts the HTML matches no `(src|href)="http…"`, contains no `<link`, and that every
`url(...)` in the output begins with `data:`. Keep that test green and the invariant holds.

The one deliberate exception lives in the *runtime*, not the compiler: `<youtube>` produces an iframe
that loads youtube.com at view time. It is documented as online-only and is the single sanctioned crack
in the wall.

## Appendix C · The three shapes a feature can take

Every feature added to Delta fits one of three molds. The deciding question is *does this need data the
browser cannot compute on its own, or just behavior?* (This appendix condenses
[CONTRIBUTING.md](CONTRIBUTING.md); the file chapters above are the worked examples.)

**Shape 1 — a new numbered environment.** Pure numbering. Add a row to `environments.ts` (Chapter 9),
register the tag in the runtime, and add a label in `strings.ts` (Chapter 15). No pass code changes —
that is the payoff of the data-driven table. *Example:* `remark`.

**Shape 2 — a new compile-time pass.** Data about *other* elements, resolved at compile time. Extend
`CompileContext` (Chapter 5), write a pass that reads/writes `ctx.registry`, wire it into `index.ts`
after numbering and before emit (Chapter 17), teach `emit` to ship the data (an attribute, a
`<template>`, or a JSON island), and add a runtime element to render it. *Examples:* `references.ts`
(Chapter 12), `toc.ts` (Chapter 13) — both follow this shape exactly; `include.ts` is a variant that
rewrites the tree rather than shipping data.

**Shape 3 — runtime-only behavior.** Purely local interaction (toggle, hover, click) that needs no
global knowledge. *No compiler change at all* — any attribute on a tag flows through `serialize` to the
`<delta-*>` output verbatim, and a runtime class reads it. *Example:* collapsible sections
(`collapsible="true"` rides through; the runtime does the folding).

The rule of thumb: **anything that needs to know about another element** (its number, its content, its
place in the document) **is a compile-time pass touching `ctx.registry`** — because the browser cannot
read other files from `file://`. Everything else is a runtime element.

## Appendix D · Glossary

- **AST** — abstract syntax tree; here a tree of `ElementNode` / `TextNode` / `RawNode` (Chapter 4).
- **chrome** — the visible furniture the runtime draws (an environment header, a pop-over, the contents
  nav). The compiler never draws chrome; it ships the *data* for it.
- **`CompileContext`** — the one mutable object threaded through every pass; the shared notebook
  (Chapter 5).
- **counter / `prefixWith`** — numbering state: a counter is an integer per name; `prefixWith` prepends
  a parent counter's display, giving "1.2" (Chapter 9).
- **data-island** — an inert `<script type="application/json" id="…">` the compiler emits and the
  runtime reads (`#delta-i18n`, `#delta-toc`). Offline-safe: just in-page text, no fetch.
- **diagnostic** — a recorded problem (`error` or `warning`) with a source position; the compiler
  records rather than throws (Chapter 5).
- **offline invariant** — rule 2: the output references nothing external (Appendix B).
- **pass** — one step of the pipeline; a function `(doc, ctx) => void` (or the string/tree endpoints).
- **`RawNode`** — pre-rendered HTML (KaTeX output) emitted *unescaped*; the one trust boundary
  (Chapter 4 / 11).
- **`RAW_TAGS`** — tags whose body is literal and never `$`-scanned (`m`, `code`, …); shared by
  `preprocess` and `math` (Chapter 6).
- **registry** — `ctx.registry`, `id → {tag, num}`, written by numbering, read by references/toc
  (Chapter 10).
- **snapshot / template** — a copy of a `<ref>` target emitted as a `<template data-delta-pop>` so the
  pop-over needs no fetch (Chapter 16).

## Appendix E · Map to the real source

Every file in `src/compiler/`, its size, and the chapter that covers it. Line counts are current as of
writing; confirm with `wc -l src/compiler/*.ts`.

| File | Lines | Chapter |
|------|------:|---------|
| `ast.ts` | 51 | 4 |
| `context.ts` | 99 | 5 |
| `preprocess.ts` | 115 | 6 |
| `parse.ts` | 57 | 7 |
| `include.ts` | 100 | 8 |
| `bibliography.ts` | 150 | — |
| `environments.ts` | 50 | 9 |
| `numbering.ts` | 76 | 10 |
| `math.ts` | 96 | 11 |
| `references.ts` | 41 | 12 |
| `toc.ts` | 135 | 13 |
| `figures.ts` | 51 | 14 |
| `theme.ts` | 41 | 14 |
| `imports.ts` | 74 | — |
| `strings.ts` | 84 | 15 |
| `emit.ts` | 154 | 16 |
| `katex-css.ts` | 25 | 16 |
| `index.ts` | 61 | 17 |
| `config.ts` | 75 | 18 |
| `project.ts` | 202 | 19 |
| **Total** | **1,737** | — |

**Not yet chaptered (—).** `bibliography.ts` (`<cite>`/`<paper>`, the citation twin of
`references.ts`) and `imports.ts` (`<import>` custom-element packs) are implemented and tested but
postdate this edition's chapters. Each follows a pattern the book already teaches — `bibliography.ts`
is a Shape-2 pass like `references.ts` (Chapter 12), and `imports.ts` reads a local asset like
`theme.ts` (Chapter 14). Read them against `CLAUDE.md` and `ROADMAP.md` (items 17-19, 26) until they
get full chapters.

**Out of scope (the browser half and the build), for when you continue:**

- `src/runtime/elements/` — the custom elements (one per file) that turn `<delta-*>` tags and the data
  islands into visible chrome (`DeltaSection`, `DeltaEnvironment`, `DeltaRef`, `DeltaToc`, …);
  `elements/index.ts`'s `defineComponents()` registers them.
- `src/runtime/utils.ts` — the shared pop-over controller.
- `src/runtime/i18n.ts` — the runtime side of localization: `t(key)` reads the `#delta-i18n` island.
- `src/runtime/index.ts` — registers the custom elements.
- `scripts/build.ts` — bundles the runtime to an IIFE string and concatenates the stylesheets into
  `src/generated/assets.ts`, the artifact `emit.ts` inlines. Documented in full in
  [BUILDING.md](BUILDING.md).
- `src/cli.ts` — argument parsing and the dispatch between single-file and project builds; its three
  `delta build` forms are covered in Chapter 19 ("Entering from the CLI").

*End of the field guide.*
