# Building Delta

How Delta turns the TypeScript sources into the two artifacts that matter: the
**generated assets** the compiler inlines (`src/generated/assets.ts`) and the
**bundled CLI** you publish (`dist/cli.js`). Both are produced by one script,
[scripts/build.ts](../scripts/build.ts), driven through `npm` scripts.

If you only want to *use* the compiler, see the [README](../README.md). If you want to
*add* a feature, see [ARCHITECTURE.md](ARCHITECTURE.md) and
[CONTRIBUTING.md](CONTRIBUTING.md). This document is about the build itself.

## The two build steps

[scripts/build.ts](../scripts/build.ts) has two functions and dispatches on its first
argument:

- `buildAssets()` -- **always** runs. Bundles the browser runtime and the stylesheets
  into `src/generated/assets.ts`.
- `buildCli()` -- runs **unless** the argument is `assets`. Bundles the CLI into
  `dist/cli.js`.

```
npm run assets      ->  tsx scripts/build.ts assets   ->  buildAssets() only
npm run build       ->  tsx scripts/build.ts          ->  buildAssets() + buildCli()
```

Both use [esbuild](https://esbuild.github.io/).

## Step 1: the generated assets (`src/generated/assets.ts`)

This file is **generated and git-ignored**, yet the compiler imports it
([emit.ts](../src/compiler/emit.ts) reads `RUNTIME_JS`, `CORE_CSS` and `THEMES` from it, and
[theme.ts](../src/compiler/theme.ts) reads `BUILTIN_THEMES`). So it must exist before anything
compiles, type-checks or tests. `buildAssets()` writes four constants:

- **`RUNTIME_JS`** -- the browser runtime. esbuild bundles
  [src/runtime/index.ts](../src/runtime/index.ts) into a single **minified IIFE** string
  (`format: "iife"`, `target: "es2020"`, `bundle: true`, `write: false`). The emitter drops
  this verbatim into a `<script>` at the end of `<body>`.
- **`CORE_CSS`** -- the `@font-face` rules for Newsreader (the body font, its woff2 files
  inlined as `data:` URIs from `@fontsource-variable/newsreader`), then `src/styles/base.css`,
  then **every** `src/styles/components/*.css` (read in sorted filename order), concatenated
  into one string. `src/styles/staged/` is not read. The `@layer` declaration at
  the top of `base.css` fixes the cascade order, so concatenation order beyond "base first"
  does not matter. Adding a `components/<name>.css` file needs no build wiring -- it is picked
  up automatically.
- **`THEMES`** -- a `{ [type]: css }` map built from `src/styles/themes/<type>.css`. The
  emitter selects one by the document's `<document type="...">` (default `article`).
- **`BUILTIN_THEMES`** -- a `{ [name]: css }` map built from `src/styles/builtin/<name>.css`,
  selected by the document's `<document theme="...">` when that value is a bare name.

  The two maps are keyed on **different axes** -- `THEMES` by document *type*, `BUILTIN_THEMES`
  by theme *name* -- and are deliberately kept separate: merging them would make
  `type="impatech"` resolve a named theme, and a built-in named `article` collide with the type
  theme. Both are built by the same `cssMap(dir)` helper, so adding either is just dropping a
  file in the directory -- no build wiring. Only the selected theme is inlined into a document;
  the rest cost a couple of KB in `dist/cli.js` and nothing in the output.

Because it is generated, never edit `src/generated/assets.ts` by hand and never commit it.

### The explorer's data (`site/packs/pipeline/dist/index.js`)

A second generated, git-ignored file. [scripts/trace.ts](../scripts/trace.ts) compiles the
two-file sample in `site/packs/pipeline/sample/` with the pipeline's `trace` hook, snapshots
the tree, the per-file context and the shared state after every step, and writes the data
plus the hand-written `element.js` as one classic script. The site page `compilador.dlt`
imports that pack, so the explorer is inlined into `docs/compilador.html` like any other
pack. `npm run trace` regenerates it; `predocs:site` and `predocs:watch` do so automatically.

## Step 2: the CLI bundle (`dist/cli.js`)

`buildCli()` bundles [src/cli.ts](../src/cli.ts) into `dist/cli.js` with
`platform: "node"`, `format: "esm"`, `target: "node20"`, and `packages: "external"`
(node_modules dependencies are left as runtime imports, not inlined). `package.json`
points the published binary at it:

```json
"bin":   { "delta": "dist/cli.js", "dlt": "dist/cli.js" },
"files": ["dist"]
```

So `npm publish` ships only `dist/`, and an installed `delta` command runs the bundle.

## npm scripts

| Script | Command | What it does |
|--------|---------|--------------|
| `assets` | `tsx scripts/build.ts assets` | regenerate `src/generated/assets.ts` only |
| `build` | `tsx scripts/build.ts` | assets + bundle the CLI to `dist/cli.js` |
| `dev` | `tsx src/cli.ts` | run the CLI from source (e.g. `npm run dev -- build doc.dlt -o out.html`) |
| `test` | `vitest run` | run the test suite once |
| `test:watch` | `vitest` | run the suite in watch mode |
| `typecheck` | `tsc --noEmit` | type-check without emitting |
| `format` | `prettier --write .` | format the code (TS, JS, JSON; see `.prettierignore` for what is left alone) |
| `format:check` | `prettier --check .` | fail if any file is not formatted (run by `prepublishOnly`) |
| `example` | `tsx src/cli.ts build examples/hello.dlt -o out.html` | compile the single-file example |
| `example:project` | `tsx src/cli.ts build examples/project/project.toml` | compile the multi-file project example |
| `example:collab` | `tsx src/cli.ts build examples/collab.dlt -o examples/collab.html` | compile the collaboration example |
| `trace` | `tsx scripts/trace.ts` | regenerate the pipeline explorer's data (`site/packs/pipeline/dist/index.js`) |
| `docs` | `npm run docs:site && npm run docs:exemplos` | build the whole published site |
| `docs:site` | `tsx src/cli.ts build site/project.toml` | compile the site project (`site/*.dlt` → `docs/*.html`); `predocs:site` runs `assets` and `trace` first |
| `docs:watch` | `tsx src/cli.ts build site/project.toml --watch` | rebuild the site on every save; `predocs:watch` runs `assets` and `trace` first |
| `docs:exemplos` | four `tsx src/cli.ts build …` calls | compile the live examples (`site/exemplos/` → `docs/exemplos/`): the two book projects, the article, the presentation; `predocs:exemplos` runs `assets` first |
| `prepack` | `npm run build` | build `dist/` before `npm pack` / `npm publish` |
| `prepublishOnly` | `npm run format:check && npm run typecheck && npm test` | refuse to publish an unformatted or broken build |

**The assets regenerate for you.** Every vitest run (`npm test`, `test:watch`, or `vitest`
directly) rebuilds them first through its global setup ([vitest.config.ts](../vitest.config.ts),
`test/setup-assets.ts`). `predev`, `pretypecheck`, `preexample` and `preexample:project` run
`npm run assets` first, so the generated file is fresh whenever you go through `npm`.

**The one gotcha:** running `tsc` or `tsx src/cli.ts` **directly** (not via `npm`) skips the
hooks. On a fresh checkout, or after editing anything under `src/runtime/` or `src/styles/`,
run `npm run assets` once first -- otherwise you will hit a missing-module error or see stale
runtime/CSS. In `test:watch`, the assets are rebuilt once per start, not on every save. (Same note in
[CONTRIBUTING.md](CONTRIBUTING.md#the-one-gotcha-generated-assets).)

## Dependencies

- **Runtime** (`dependencies`): `katex` (compile-time math rendering), `highlight.js`
  (compile-time code highlighting, loaded on the first `<code lang>`), `saxes` (strict XML
  parsing), `smol-toml` (`project.toml` parsing).
- **Build / dev** (`devDependencies`): `esbuild` (bundling), `@fontsource-variable/newsreader`
  (the body font, inlined into `CORE_CSS` at build time), `tsx` (run TS directly),
  `typescript` (type-checking), `vitest` (tests), `happy-dom` (the runtime tests' DOM),
  `prettier` (formatting),
  `@types/*`.

## A typical loop

```
npm install
npm run assets          # once, so direct tsx/vitest calls work
npm test                # or: npm run typecheck
npm run example         # compile examples/hello.dlt -> out.html, open from file://
npm run build           # produce dist/cli.js for distribution
```
