# Delta

> **Beta.** Delta is usable and published on npm as [`delta-lang`](https://www.npmjs.com/package/delta-lang)
> (the CLI command is `delta`). The language and output are still evolving — expect
> changes before 1.0.

Delta is a LaTeX-inspired XML markup language for scientists — mathematicians in
particular — and students to write **interactive books, articles and presentations**.
A `.dlt` file compiles into a **single standalone HTML file** that works offline,
straight from `file://`: math, numbering and cross-references are all resolved at
compile time, so nothing is fetched at runtime.

## Install

```bash
npm i -g delta-lang
delta build doc.dlt -o doc.html      # then open doc.html in any browser
delta build doc.dlt -o doc.html --watch   # rebuild on every change
```

The package name is `delta-lang` (the bare `delta` name was taken on npm); the
installed command is `delta`.

`--watch` (or `-w`) keeps `delta` running and recompiles whenever the document **or
anything it pulls in** changes — `<include>` files, the theme CSS, `<import>` packs,
the `.ref` bibliography, figure images, or `project.toml`. Press Ctrl-C to stop.

```xml
<document lang="en" type="paper">
  <title>Hello, Delta</title>
  <section id="sec:intro">
    <title>Introduction</title>
    Inline math like $e^{i\pi} + 1 = 0$ just works — even $a < b$.
    <theorem id="thm:pyth">
      <title>Pythagorean Theorem</title>
      <equation id="eq:pyth">a^2 + b^2 = c^2</equation>
    </theorem>
  </section>
</document>
```

## How it works

Every tag becomes a `<delta-tag>` custom element in the output. The **compiler
resolves data** — LaTeX-style numbering (`Theorem 1.2`), reference targets, KaTeX
HTML — and ships it as attributes and pre-rendered content; the **inlined runtime
renders the chrome** (headers, collapsing, pop-overs). KaTeX itself never ships to
the browser, only its CSS with fonts embedded as `data:` URIs.

Extending Delta is meant to be easy: a new numbered environment is one row in
[src/compiler/environments.ts](src/compiler/environments.ts), and a new interactive
tag is one custom element under [src/runtime/elements/](src/runtime/elements/).

## From source

```bash
npm install
npm run example        # compiles examples/hello.dlt → out.html, open it in a browser
npm test               # vitest
npm run build          # dist/cli.js
node dist/cli.js build mydoc.dlt -o mydoc.html
```

## Status

Beta: the core pipeline (preprocess → parse → number → math → emit) works end-to-end.
See [ROADMAP.md](ROADMAP.md) for what's done and what's next.

## Documentation

**For writing documents** — the user-facing docs are in **Portuguese**, and they are
written in Delta itself: the sources are in [site/](site/) and compile to the published
site in `docs/` (`npm run docs`). Start at [docs/index.html](docs/index.html), or read
the sources directly — [site/comecar.dlt](site/comecar.dlt) is the getting-started guide
and the tag reference begins at [site/estrutura.dlt](site/estrutura.dlt).

- **[docs/TUTORIAL_COMPONENTES.md](docs/TUTORIAL_COMPONENTES.md)** (pt-BR) — building a
  custom component end to end, the entry point to the package system.

**For working on the compiler** (English):

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how the compiler works: the
  pipeline traced end-to-end, the three core concepts (AST, context, environments
  table), and the compile-time/runtime split. Start here to understand the repo.
- **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** — how to add features: the dev
  workflow and the three shapes every feature takes, each with a worked example.
- **[docs/COMPILER_BOOK.md](docs/COMPILER_BOOK.md)** — the deep field guide: a
  chapter-by-chapter walk through every compiler pass and the context it threads.
- **[docs/BUILDING.md](docs/BUILDING.md)** — the build: the generated assets, the CLI
  bundle, and every npm script.
- **[docs/PACKAGES.md](docs/PACKAGES.md)** and
  **[docs/AUTHORING_PACKAGES.md](docs/AUTHORING_PACKAGES.md)** — the package system:
  its design, and the reference for authoring one.
- **[ROADMAP.md](ROADMAP.md)** — planned features in dependency order.

## Authoring notes (strict XML)

- No valueless attributes — write `collapsible="true"`, not bare `collapsible`.
- `<`, `>` and `&` are fine **inside math and code**; in prose, use `&lt;`, `&gt;`, `&amp;`.
- `$…$` inline, `$$…$$` display, `\$` for a literal dollar.
- `<equation>` is display + numbered; `<m>` is inline; `<equations>` is an aligned block
  (use `&` and `\\` directly — no escaping inside it).
