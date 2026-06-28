# Delta

Delta is a LaTeX-inspired XML markup language for scientists — mathematicians in
particular — and students to write **interactive books, articles and presentations**.
A `.dlt` file compiles into a **single standalone HTML file** that works offline,
straight from `file://`: math, numbering and cross-references are all resolved at
compile time, so nothing is fetched at runtime.

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

## Quickstart

```bash
npm install
npm run example        # compiles examples/hello.dlt → out.html, open it in a browser
npm test               # vitest
npm run build          # dist/cli.js
node dist/cli.js build mydoc.dlt -o mydoc.html
```

## Status

Early scaffold: the core pipeline (preprocess → parse → number → math → emit) works
end-to-end. See [ROADMAP.md](ROADMAP.md) for what's done and what's next, and
[DELTA_INFO.md](DELTA_INFO.md) for the full language vision.

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how the compiler works: the
  pipeline traced end-to-end, the three core concepts (AST, context, environments
  table), and the compile-time/runtime split. Start here to understand the repo.
- **[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)** — how to add features: the dev
  workflow and the three shapes every feature takes, each with a worked example.
- **[docs/COMPILER_BOOK.md](docs/COMPILER_BOOK.md)** — the deep field guide: a
  chapter-by-chapter walk through every compiler pass and the context it threads.
- **[docs/BUILDING.md](docs/BUILDING.md)** — the build: the generated assets, the CLI
  bundle, and every npm script.
- **[ROADMAP.md](ROADMAP.md)** — planned features in dependency order.
- **[DELTA_INFO.md](DELTA_INFO.md)** — the language vision.

## Authoring notes (strict XML)

- No valueless attributes — write `collapsible="true"`, not bare `collapsible`.
- `<`, `>` and `&` are fine **inside math and code**; in prose, use `&lt;`, `&gt;`, `&amp;`.
- `$…$` inline, `$$…$$` display, `\$` for a literal dollar.
- `<equation>` is display + numbered; `<m>` is inline; `<equations>` is an aligned block
  (use `&` and `\\` directly — no escaping inside it).
