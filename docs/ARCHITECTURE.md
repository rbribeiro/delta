# Architecture

This document explains how the Delta compiler is put together: the two rules, the three
structures everything is built on, the pipeline (declared as data in one file), and the
compile-time/runtime split that makes the output work offline. If you want to *add* a
feature, read this first, then [CONTRIBUTING.md](CONTRIBUTING.md). The same story, longer
and in Portuguese, with an interactive step-by-step explorer, is the site page
[site/compilador.dlt](../site/compilador.dlt) (published as `docs/compilador.html`).

## The two rules

1. **The compiler resolves data; the runtime draws chrome.** Numbering, cross-references,
   the table of contents, KaTeX rendering and asset inlining all happen in the compiler,
   which ships the results as attributes on `<delta-*>` tags and as JSON islands. It never
   emits a `<h2>` or a "Theorem 1.2" header: it emits `<delta-theorem num="1.2">` and a custom
   element in the browser draws the header, localized.
2. **The output references nothing external.** No `<link>`, no URL, no `fetch`. Fonts and
   images are `data:` URIs; CSS and the runtime are inlined text. A file opened from
   `file://` cannot fetch its siblings, so even a cross-file reference target is *copied*
   into the referencing output. `test/emit.test.ts` guards this invariant.

## The three structures

### A deliberately generic AST ([ast.ts](../src/compiler/ast.ts))

Three node types, nothing else: `ElementNode` (any tag, keyed by the `tag` string, with an
`attrs` bag and `children`), `TextNode`, and `RawNode` (pre-rendered HTML the emitter copies
verbatim; only KaTeX and the code highlighter produce one). There are no per-feature
subclasses. Passes branch on `tag` and **write results back into `attrs`** (numbering writes
`num`; references write `data-target-num`). `elements()`, `textContent()`, `hasTag()` and
`titleOf()` are the helpers passes use to walk and read the tree.

### The shared context ([context.ts](../src/compiler/context.ts))

One mutable `CompileContext` per file, threaded through every pass. Passes never call each
other and share no globals: they communicate **only** through this object and through node
attrs. It carries `diagnostics`, `registry` (id → `{tag, num}`), `referencedIds`, `toc`,
`mathUsed`, `lang`, the theme fields, `imports`, `papers`, `citedPapers`, `team`, `review`,
`final` and `deps`. The who-writes / who-reads matrix is in the site page; the rule it proves
is that every read comes *after* its write in pipeline order. In a project, four of those
maps (`registry`, `papers`, `citedPapers`, `team`) are the **same instance** in every file's
context; the rest of the project-wide state (`numbering`, `globalById`, `idToFile`, `bibOut`,
the project's own context) lives in `Shared` (see below).

### The data-driven environments table ([environments.ts](../src/compiler/environments.ts))

All LaTeX-style numbering is data. Each numbered tag maps to a `counter` and an optional
`prefixWith` counter (`theorem` → `"1.2"`: section 1, theorem 2; the prefix is skipped while
the parent counter is still 0). Each theorem-like environment has its own counter;
`equation`/`equations` share one, as do `video`/`youtube`. `COUNTER_RESETS` says which
counters restart when a parent increments; its keys and values are counter names. The
numbering pass is a generic engine over this table, so adding an environment is one row
(plus its label in `strings.ts` and its tag in the runtime).

## The pipeline ([pipeline.ts](../src/compiler/pipeline.ts))

**The order things happen in is the architecture, and it lives in one place**: the `PIPELINE`
table, a list of phases, each a list of steps. A compilation is a list of `FileUnit`s that
share one `Shared` state, run by `runPipeline`. **A single file is a project of one file**:
`compileSource`, `compileFile` ([index.ts](../src/compiler/index.ts)) and `compileProject`
([project.ts](../src/compiler/project.ts)) only build that list and call the runner.

A step is either `each` (runs on every file, in input order, before the next step starts on
any file) or `all` (runs once, project-wide). Pass-major order is what lets a per-file step
rely on everything earlier steps did in *every* file. The step name is the function it calls.

| Phase | Steps (in order) | Notes |
|---|---|---|
| `load` | `resolvePackages`ᵃ, `readSource`, `parse`, `resolveIncludes`, `applyDocumentDefaults`, `finalizeReview`, `collectTeam`, `expandAnimated`, `expandCover` | **bails** after this phase if any context has an error |
| `collab` | `resolveCollab`, `summarizeFinal`ᵃ | runs once every file's team is known |
| `bibliography` | `loadBibliography`, `numberCitations`, `fillProjectBibliography`ᵃ | before numbering, so spliced `<paper>` nodes flow through later passes |
| `numbering` | `numberDocument`, `buildIdMaps`ᵃ | one `NumberingState` runs through the files in order |
| `render` | `renderMath`, `highlightCode`, `buildProjectToc`ᵃ, `buildProjectReview`ᵃ, `resolveReferences`, `annotateCrossFileRefs`, `annotateCrossFileCites`, `inlineFigures`, `resolveTheme`, `resolveImports`, `resolveLineBreaks` | everything that needs the registry, then everything inlined |
| `emit` | `emit` | one standalone HTML per file |

ᵃ project-wide (`all`); the rest are per file (`each`). `test/pipeline.test.ts` pins this list
literally, asserts that a single-file build and a project-of-one build produce identical
HTML, and exercises the trace hook.

Each step has a one-line `what`. A `(doc, ctx)` pass becomes a step through the `perFile`
adapter; a step that needs project state receives `shared` as a third argument.

**The trace hook.** `CompileOptions.trace` is called after every file of an `each` step
(with `file`) and after every step, with the *live* `files` and `shared`. It costs nothing
when absent. `scripts/trace.ts` uses it to compile a two-file sample and snapshot the tree,
the context and the shared state after every step; that data drives the site's pipeline
explorer, so the docs never drift from the code.

### Diagnostics, not exceptions

An author mistake is never a `throw`. A pass records `error(ctx, msg, el.pos)` or
`warn(ctx, …)` and continues. An error means "produce no output"; a warning means "the page
is still usable". The runner checks for errors once, after `load`; the CLI prints everything
with file, line and column.

## The compile-time / runtime split in detail

The runtime ([src/runtime/](../src/runtime/)) is bundled **separately** from the CLI.
[scripts/build.ts](../scripts/build.ts) uses esbuild to bundle `src/runtime/index.ts` into a
minified IIFE string and, together with the stylesheets, writes them as constants into
`src/generated/assets.ts` (`RUNTIME_JS`, `CORE_CSS`, `THEMES`, `BUILTIN_THEMES`). That file is
generated and git-ignored; every relevant npm script regenerates it first. The build is
documented in [BUILDING.md](BUILDING.md).

`emit` assembles, in this order: core CSS, the built-in named theme, the per-type theme, the
KaTeX CSS (only when `mathUsed`), each pack's CSS, the author's theme (last, unlayered);
then the serialized body, one `<template data-delta-pop="id">` per referenced id (a copy of
the target; for containers only the title), the `#delta-toc`, `#delta-review` and
`#delta-i18n` islands, the runtime, and each pack's JS after it (so `window.Delta` exists).

Two mechanisms keep the output offline: [katex-css.ts](../src/compiler/katex-css.ts) inlines
KaTeX's stylesheet with its woff2 fonts as `data:` URIs, and the pop-over snapshots ship a
copy of every referenced target (from the project-wide `globalById` when the target lives in
another output). The same inlining seam is how Delta is **extended**: `<import>` packs and
`project.toml` packages are read at compile time and inlined ([PACKAGES.md](PACKAGES.md),
[AUTHORING_PACKAGES.md](AUTHORING_PACKAGES.md)).

## File map

```
src/
  cli.ts                       executable entry point (argv → compile → write; review/create/install subcommands)
  review-report.ts             `delta review` text/JSON formatting (pure)
  scaffold.ts, install.ts      `delta create`, `delta install`
  compiler/
    pipeline.ts                THE pipeline: phases/steps table, runPipeline, Shared, the trace hook — start here
    index.ts, project.ts       the entry points (compileSource/compileFile; compileProject), both thin
    ast.ts                     ElementNode / TextNode / RawNode + elements, textContent, hasTag, titleOf
    context.ts                 CompileContext: diagnostics, registry, flags; createContext, error, warn
    environments.ts            the numbering data table (ENVIRONMENTS, COUNTER_RESETS)
    preprocess.ts              escape < > & inside math/raw regions (pre-parse); escapeHtml
    parse.ts                   strict XML → generic AST (saxes)
    files.ts                   isRemote, readUserFile (+addDep), withFile (diagnostics attributed to another file)
    include.ts                 splice <include> files into one tree (cycle detection)
    document.ts                project.toml [document] defaults onto <document>; ctx.lang
    config.ts                  project.toml parsing (smol-toml)
    final.ts                   --final: strip marks, accept changes (the clean publication)
    team.ts                    <team>/<member> → ctx.team (node removed)
    collab.ts                  comment/todo/change/status vocabulary: defaults + warnings
    animated.ts, cover.ts      presentation sugar (animated → reveal; <cover> → <slide>)
    bibliography.ts            load .ref papers; number <cite>; fill the (first) <bibliography>
    numbering.ts               assigns num attrs, fills the registry; NumberingState
    crossfile.ts               buildIdMaps (globalById/idToFile); cross-file href annotations
    math.ts                    compile-time KaTeX (+ \ref{} inside math)
    code.ts                    compile-time highlight.js for <code lang>
    toc.ts                     heading tree + auto-slug ids (single + project)
    review.ts                  collects comments/tasks/changes/status blocks → ctx.review
    references.ts              <ref to> → data-target-num/tag; marks targets for snapshotting
    figures.ts                 <figure src> images → data: URIs
    theme.ts                   <document theme / theme-accent / theme-mode> → ctx
    imports.ts                 <import> packs and project packages → ctx.imports
    linebreaks.ts              blank lines in prose → <br><br>
    strings.ts                 i18n table (en, pt, …) + lang resolvers
    emit.ts                    AST → standalone HTML (+ templates and the JSON islands)
    katex-css.ts               KaTeX CSS with data: fonts (offline math)
  runtime/
    index.ts                   registers the custom elements; window.Delta
    deck.ts                    the presentation controller
    utils.ts, i18n.ts          the shared popover controller; t(key) from the #delta-i18n island
    elements/                  one <delta-*> custom element per file (browser chrome)
  styles/
    base.css                   @layer delta.base — tokens + page grid + primitives
    components/*.css           @layer delta.components — one file per component
    themes/<type>.css          @layer delta.theme — per-document-type overrides
    builtin/<name>.css         @layer delta.builtin — named themes (theme="impatech")
  generated/assets.ts          GENERATED, git-ignored (RUNTIME_JS + CORE_CSS + THEMES + BUILTIN_THEMES)
scripts/build.ts               bundles runtime → assets.ts, and CLI → dist/cli.js
scripts/trace.ts               compiles the explorer's sample with the trace hook → site/packs/pipeline/dist/index.js
site/                          the documentation site, written in Delta (pt-BR); compiled into docs/
site/packs/pipeline/           the pipeline explorer pack (element.js, theme.css, descriptions.json, sample/)
examples/                      hello.dlt (single file), project/ (multi-file), collab.dlt, slides.dlt
test/                          one suite per pass; helpers.ts (compile/parsed/numbered); pipeline.test.ts
```

The single most important file to internalize is
[src/compiler/pipeline.ts](../src/compiler/pipeline.ts): the order things happen in *is*
the architecture.
