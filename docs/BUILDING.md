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
([emit.ts](../src/compiler/emit.ts) reads `RUNTIME_JS`, `CORE_CSS` and `THEMES` from it).
So it must exist before anything compiles, type-checks or tests. `buildAssets()` writes
three constants:

- **`RUNTIME_JS`** -- the browser runtime. esbuild bundles
  [src/runtime/index.ts](../src/runtime/index.ts) into a single **minified IIFE** string
  (`format: "iife"`, `target: "es2020"`, `bundle: true`, `write: false`). The emitter drops
  this verbatim into a `<script>` at the end of `<body>`.
- **`CORE_CSS`** -- `src/styles/base.css` followed by **every** `src/styles/components/*.css`
  (read in sorted filename order) concatenated into one string. The `@layer` declaration at
  the top of `base.css` fixes the cascade order, so concatenation order beyond "base first"
  does not matter. Adding a `components/<name>.css` file needs no build wiring -- it is picked
  up automatically.
- **`THEMES`** -- a `{ [type]: css }` map built from `src/styles/themes/<type>.css`. The
  emitter selects one by the document's `<document type="...">` (default `article`).

Because it is generated, never edit `src/generated/assets.ts` by hand and never commit it.

## Step 2: the CLI bundle (`dist/cli.js`)

`buildCli()` bundles [src/cli.ts](../src/cli.ts) into `dist/cli.js` with
`platform: "node"`, `format: "esm"`, `target: "node20"`, and `packages: "external"`
(node_modules dependencies are left as runtime imports, not inlined). `package.json`
points the published binary at it:

```json
"bin":   { "delta": "./dist/cli.js" },
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
| `example` | `tsx src/cli.ts build examples/hello.dlt -o out.html` | compile the single-file example |
| `example:project` | `tsx src/cli.ts build examples/project/project.toml` | compile the multi-file project example |

**Pre-hooks regenerate the assets for you.** `predev`, `pretest`, `pretypecheck`,
`preexample` and `preexample:project` all run `npm run assets` first, so the generated
file is fresh whenever you go through `npm`.

**The one gotcha:** `test:watch` has **no** pre-hook, and running `vitest` or `tsc`
**directly** (not via `npm`) skips the hook too. On a fresh checkout, or after editing
anything under `src/runtime/` or `src/styles/`, run `npm run assets` once first --
otherwise you will hit a missing-module error or see stale runtime/CSS. (Same note in
[CONTRIBUTING.md](CONTRIBUTING.md#the-one-gotcha-generated-assets).)

## Dependencies

- **Runtime** (`dependencies`): `katex` (compile-time math rendering), `saxes` (strict XML
  parsing), `smol-toml` (`project.toml` parsing).
- **Build / dev** (`devDependencies`): `esbuild` (bundling), `tsx` (run TS directly),
  `typescript` (type-checking), `vitest` (tests), `@types/*`.

## A typical loop

```
npm install
npm run assets          # once, so direct tsx/vitest calls work
npm test                # or: npm run typecheck
npm run example         # compile examples/hello.dlt -> out.html, open from file://
npm run build           # produce dist/cli.js for distribution
```
