# Architecture

This document explains how the Delta compiler is put together: the pipeline, the
three concepts everything is built on, and the compile-time/runtime split that
makes the output work offline. If you want to *add* a feature, read this first,
then [CONTRIBUTING.md](CONTRIBUTING.md).

## The guiding principle

Delta does work **at compile time** so the browser ships finished markup. Numbering,
cross-references, math rendering and asset inlining all happen in the compiler. The
output is a single `.html` file that opens straight from `file://` with no network,
no `fetch`, and no external resources — math, fonts, styles and behavior are all
inlined.

This split shows up everywhere, so internalize it early:

- **The compiler resolves *data*.** It computes the number `1.2`, renders LaTeX to
  KaTeX HTML, records which ids exist — and ships those as attributes and
  pre-rendered content on `<delta-*>` tags.
- **The runtime renders *chrome*.** Inlined custom elements read that data in the
  browser and build the visible parts: headers, collapse toggles, pop-overs.

The compiler never emits a `<h2>` or a "Theorem 1.2" header. It emits
`<delta-section num="1.2">` and lets the browser draw it.

## The two entry points

- **[src/cli.ts](../src/cli.ts)** is the *executable*. It parses `argv`, reads the
  file, calls the compiler, writes the output, prints diagnostics. No compilation
  logic lives here.
- **[src/compiler/index.ts](../src/compiler/index.ts)** is the *orchestrator* — the
  heart of the project. `compileSource()` is the entire pipeline in a few lines and
  is the best map of the codebase:

  ```ts
  const doc = parse(preprocess(source), ctx);   // text → AST
  if (!doc || hasErrors(ctx)) return undefined;  // bail on malformed XML
  resolveIncludes(doc, ctx);                      // splice <include> files into one tree
  loadBibliography(doc, ctx);                     // build the paper registry
  resolveCitations(doc, ctx);                     // number <cite>; fill <bibliography>
  numberDocument(doc, ctx);                       // annotate the AST + registry
  renderMath(doc, ctx);                           // replace math with rendered HTML
  resolveReferences(doc, ctx);                    // <ref to> → num+kind; mark snapshots
  buildToc(doc, ctx);                             // collect the heading tree (if a <toc>)
  inlineFigures(doc, ctx);                        // <figure src> images → data: URIs
  resolveTheme(doc, ctx);                         // <document theme> CSS → ctx.userCss
  resolveImports(doc, ctx);                       // <import> packs → ctx.imports
  return emit(doc, ctx);                          // AST → standalone HTML
  ```

**Pass order is load-bearing.** Includes merge first so everything downstream sees one
tree; the bibliography splices cited papers before numbering/math process them;
numbering fills the registry that references and the TOC read; the emitter always runs
last. Don't reorder without understanding the dependencies. The full ordered table
(with each pass's `CompileContext` reads/writes) is Appendix A of
[COMPILER_BOOK.md](COMPILER_BOOK.md).

## The pipeline, stage by stage

We'll trace this fragment of [examples/hello.dlt](../examples/hello.dlt):

```xml
<theorem id="thm:pyth">
  <title>Pythagorean Theorem</title>
  For a right triangle... $a^2 + b^2 = c^2$
  <equation id="eq:pyth">a^2 + b^2 = c^2</equation>
</theorem>
```

The five stages below are the spine — the ones our fragment touches. The full pipeline
threads more passes between `parse` and `emit` (in order: `resolveIncludes`,
`loadBibliography`, `resolveCitations`, numbering, math, `resolveReferences`, `buildToc`,
`inlineFigures`, `resolveTheme`, `resolveImports`), each following the same "read the
context, write the tree" contract. Appendix A of [COMPILER_BOOK.md](COMPILER_BOOK.md) has
the complete ordered list with every pass's `CompileContext` reads and writes.

### 1. `preprocess` — string → string ([preprocess.ts](../src/compiler/preprocess.ts))

Runs on raw text *before* XML parsing. Authors need to write `<`, `>` and `&` freely
inside math and code, but those characters break XML. This stage finds math regions
(`$…$`, `$$…$$`) and `RAW_TAGS` (`m`, `math`, `equation`, `equations`, `code`,
`codeblock`) and entity-escapes those characters **only inside them** — the rest of
the document is untouched. `\$` is preserved as a literal-dollar marker.

This is why `$a < b$` is legal in a strict-XML file: by the time the parser sees it,
it reads `$a &lt; b$`. The parser unescapes it again, so later passes see `a < b`.

### 2. `parse` — string → AST ([parse.ts](../src/compiler/parse.ts))

[saxes](https://www.npmjs.com/package/saxes) walks the XML and builds a generic tree.
Our fragment becomes:

```
ElementNode { tag: "theorem", attrs: {id: "thm:pyth"}, pos: {...}, children: [
  ElementNode { tag: "title", children: [TextNode "Pythagorean Theorem"] },
  TextNode "For a right triangle... $a^2 + b^2 = c^2$",
  ElementNode { tag: "equation", attrs: {id: "eq:pyth"},
                children: [TextNode "a^2 + b^2 = c^2"] }
]}
```

Every tag is the *same* `ElementNode` shape — `theorem`, `title` and `equation`
differ only by the `tag` string. Malformed XML produces an error diagnostic and a
`null` document, so the pipeline bails before annotating anything.

### 3. `numberDocument` — mutates AST + ctx ([numbering.ts](../src/compiler/numbering.ts))

Walks the tree consulting the [environments table](../src/compiler/environments.ts).
`theorem` uses the `theorem` counter prefixed by `section`, so it writes
`attrs.num = "1.1"`. `equation` likewise gets `"1.1"`. Both ids are recorded:

```
ctx.registry = {
  "thm:pyth" → { tag: "theorem",  num: "1.1" },
  "eq:pyth"  → { tag: "equation", num: "1.1" },
}
```

That registry is the seam for everything cross-referential that comes later — refs,
TOC, citations all read it.

### 4. `renderMath` — mutates AST + ctx ([math.ts](../src/compiler/math.ts))

Finds `$…$` inside text nodes and the content of math tags, runs KaTeX
`renderToString`, and replaces each with a `RawNode` holding the rendered HTML. Sets
`ctx.mathUsed = true`. After this stage **no LaTeX source survives** — only HTML.
KaTeX errors are warnings (with the source text emitted as fallback), not build
failures.

### 5. `emit` — AST → HTML string ([emit.ts](../src/compiler/emit.ts))

Two jobs:

1. `serialize()` renames every tag `x` → `delta-x`, writing attributes verbatim.
   `RawNode`s (KaTeX HTML) are copied without escaping; `TextNode`s are escaped.
   The theorem becomes `<delta-theorem id="thm:pyth" num="1.1">…</delta-theorem>`.
2. The body is wrapped in a document `<head>` with the inlined `CORE_CSS`
   (base layer + components), then the per-type theme layer chosen by
   `<document type="…">` (`THEMES[type]`, default `article`), then
   conditionally the KaTeX CSS (only when `ctx.mathUsed`, since it's ~1 MB with
   embedded fonts), and the runtime IIFE at the end of `<body>`.

The output contains **no rendered numbers or headers** — only data-bearing tags.

### 6. The browser — runtime, not part of the compiler ([src/runtime/elements/](../src/runtime/elements/))

When the page loads, the custom elements upgrade. `DeltaEnvironment` reads
`getAttribute("num")` → `"1.1"`, finds the `<delta-title>` child, and prepends a
`<header>` reading "Theorem 1.1 (Pythagorean Theorem).". The compiler supplied the
data; the browser drew the chrome.

## The three central concepts

### 1. A deliberately generic AST ([ast.ts](../src/compiler/ast.ts))

Three node types, nothing else:

- **`ElementNode`** — any tag, keyed by the `tag` string. Passes branch on `tag` and
  **write results back into `attrs`** (numbering writes `attrs.num`).
- **`TextNode`** — plain text (escaped on emit).
- **`RawNode`** — pre-rendered HTML, e.g. KaTeX output (copied verbatim on emit).

There are no per-feature subclasses. Adding a tag never means adding a node type —
it's configuration plus, optionally, a renderer. `elements()` and `textContent()`
are the helpers passes use to walk and read the tree.

### 2. The shared context ([context.ts](../src/compiler/context.ts))

One mutable `CompileContext` is created per compile and threaded through every pass.
Passes communicate **only** through it and through `node.attrs` — there is no other
shared state. It carries:

- `diagnostics` — errors and warnings, each with a source position.
- `registry` — `Map<id, {tag, num}>`, written by numbering, read by reference-style
  passes. This is the mechanism for cross-element knowledge.
- `mathUsed` — set by the math pass; the emitter uses it to decide whether to inline
  KaTeX CSS.

When you add a cross-cutting pass, you extend this interface (e.g. add `templates`
for pop-over snapshots) rather than inventing a new channel.

### 3. The data-driven environments table ([environments.ts](../src/compiler/environments.ts))

All LaTeX-style numbering is **data, not code**. Each numbered tag maps to:

- `counter` — which counter it increments. The whole theorem family (`theorem`,
  `lemma`, `corollary`, `proposition`, `conjecture`, `definition`) shares the
  `theorem` counter, exactly like `\newtheorem{lemma}[theorem]` in LaTeX.
- `prefixWith` — the counter whose current value is prepended (`"1.2"` = section 1,
  theorem 2), skipped while that parent counter is still 0.

`COUNTER_RESETS` says which counters restart when a parent increments (a new section
resets theorem and equation counters). The numbering pass just iterates this table —
it contains no per-environment logic, so adding an environment is one row.

## The compile-time / runtime split in detail

The runtime ([src/runtime/](../src/runtime/)) is bundled **separately** from the CLI.
[scripts/build.ts](../scripts/build.ts) uses esbuild to bundle `src/runtime/index.ts`
into a minified IIFE string and, together with the stylesheets, writes them as
constants into `src/generated/assets.ts`: `RUNTIME_JS`, `CORE_CSS` (`base.css` plus
every `components/*.css`, concatenated) and `THEMES` (each `themes/<type>.css` keyed
by file name). The emitter imports them and inlines `CORE_CSS` followed by the theme
layer for the document's `type`.

**`src/generated/assets.ts` is generated and git-ignored.** It must exist before any
typecheck, test or compile, because the emitter imports from it. Every relevant npm
script has a pre-hook that regenerates it (`npm run assets`); only direct `tsx` or
`vitest` invocations on a fresh checkout need it run manually. The build steps, scripts
and artifacts are documented in full in [BUILDING.md](BUILDING.md).

Two mechanisms keep the output offline:

- **KaTeX assets** ([katex-css.ts](../src/compiler/katex-css.ts)) — KaTeX's stylesheet
  is inlined with its woff2 fonts embedded as `data:` URIs and the woff/ttf fallbacks
  stripped. This is what makes math render from `file://`.
- **Pop-over snapshots** — `resolveReferences` records which ids are referenced, and
  `emit` (`renderTemplates`) snapshots each into a `<template data-delta-pop="id">` so the
  runtime clones them locally instead of fetching across files. On the multi-file project
  path a project-wide `globalById` lets a cross-file target's copy ship into each output.

The `test/emit.test.ts` "references no external resources" test guards this invariant.
Keep it passing.

## File map

```
src/
  cli.ts                       executable entry point (argv → compile → write)
  compiler/
    index.ts                   the pipeline orchestrator — start here
    preprocess.ts              escape <,>,& inside math/raw regions (pre-parse)
    parse.ts                   strict XML → generic AST (saxes)
    ast.ts                     ElementNode / TextNode / RawNode + walk helpers
    context.ts                 CompileContext: diagnostics, registry, flags
    include.ts                 splice <include> files into one tree (cycle detection)
    environments.ts            the numbering data table
    numbering.ts               assigns num attrs, fills the registry
    math.ts                    compile-time KaTeX
    references.ts              <ref to> → num+kind; marks targets for snapshotting
    bibliography.ts            load .ref papers; number <cite>; fill <bibliography>
    toc.ts                     heading tree + auto-slug ids (single + project)
    figures.ts                 <figure src> images → data: URIs
    theme.ts                   <document theme> author CSS → ctx.userCss
    imports.ts                 <import> custom-element packs → ctx.imports
    strings.ts                 i18n table (en, pt, …) + lang resolvers
    project.ts                 multi-file projects (shared registry/numbering)
    config.ts                  project.toml parsing (smol-toml)
    emit.ts                    AST → standalone HTML
    katex-css.ts               KaTeX CSS with data: fonts (offline math)
  runtime/
    index.ts                   registers the custom elements (defineComponents)
    utils.ts                   the shared Delta.popover controller
    i18n.ts                    runtime t(key): reads the #delta-i18n island
    elements/                  one <delta-*> custom element per file (browser chrome)
                               (section, environment, ref, toc, floating, hint, cite,
                                bibliography, sidenote, media, link; shared.ts helpers)
  styles/
    base.css                   @layer delta.base — tokens + page grid + primitives
    components/*.css            @layer delta.components — one file per component
                               (structure, theorems, math, sidenote, columns, link,
                                reference, hint, figure, bibliography, toc, collapse,
                                popover, floating, tweaks); tweaks is CSS-staged
    themes/<type>.css          @layer delta.theme — per-document-type token overrides
  generated/assets.ts          GENERATED, git-ignored (RUNTIME_JS + CORE_CSS + THEMES)
scripts/build.ts               bundles runtime → assets.ts, and CLI → dist/cli.js
examples/hello.dlt             the single-file reference example
examples/project/              the multi-file project example (project.toml + chapters)
test/                          one suite per pass (parse, numbering, references, toc, …)
```

The single most important file to internalize is
[src/compiler/index.ts](../src/compiler/index.ts): the order things happen in *is*
the architecture.
