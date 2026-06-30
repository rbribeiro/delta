# Packages — how Delta ships and extends features

> **Status:** implemented (ROADMAP item 46). All three channels ship — local `<import>`,
> bare-specifier `<import>` from `node_modules`, and `packages` in `project.toml`. This
> document doubles as the design rationale (ADR) and the reference for the format.

Delta will keep adding components. Two questions decide how that scales, and they are
the most load-bearing choices in the project:

1. **Extension** — how does someone add a feature Delta doesn't ship?
2. **Payload** — how do we avoid every `.html` carrying code it never uses?

This document answers both with **one mechanism: the package.** A Delta package bundles
the browser-side of a feature (custom elements + CSS); the compiler inlines a package
only when a document declares it.

## TL;DR

- **Core is monolithic.** The built-in runtime and component CSS are always inlined as
  one blob each. We do **not** tree-shake them per document. (Rationale below — the
  numbers don't justify it.)
- **A package is the unit of extension and of on-demand inlining.** It is an npm package
  or a local folder that ships a classic browser script registering `delta-*` custom
  elements, plus optional CSS.
- **Three ways to pull a package in**, all feeding one inliner: `<import src>` (local
  folder), `<import src="pkg-name">` (resolved from `node_modules`), and a
  `packages = [...]` list in `project.toml` (project-wide).
- **Packages are runtime-only.** They never run code in the compiler. Features that need
  compile-time work (numbering, references) stay first-party.
- **`window.Delta` is the public API** packs build against.

## Why core stays monolithic

The instinct is to chunk the built-in runtime + CSS and inline only the pieces a document
uses. We measured the payload of a compiled file first:

| Payload | Size | Gated today? |
|---|---|---|
| Newsreader fonts (base64, inside `CORE_CSS`) | ~360 KB | ❌ always |
| KaTeX CSS (base64 fonts) | ~360 KB | ✅ when math is used (`ctx.mathUsed`) |
| `base.css` + every `components/*.css` | ~88 KB | ❌ always |
| Runtime IIFE (`RUNTIME_JS`, minified) | ~28 KB | ❌ always |

The runtime + component CSS that per-feature chunking could remove is **~90 KB at most**.
The bytes that actually dominate a file are the two **font** blobs: KaTeX (~360 KB) is
**already** on-demand, and the Newsreader fonts (~360 KB) are universal — every document
sets type in them. So:

- Tree-shaking core buys little and costs a lot: a per-feature build split, a tag→chunk
  registry, dependency ordering, and a fragmented runtime that's harder to reason about.
- The real size lever, if size ever becomes a priority, is **font subsetting** (ship only
  the glyphs a document uses), which is independent of any of this.

**Decision:** keep core as one runtime + one CSS blob. Honor "inline only what's needed"
at **package granularity** instead — which is exactly where new, optional, potentially
heavy features live.

*Rejected alternative:* per-feature chunking of the built-in runtime/CSS (a tag-gated
module registry over `elements/*` and `components/*`). Reconsider only if built-in CSS/JS
grows large enough that ~90 KB becomes ~hundreds of KB, or alongside font subsetting.

## What a package is

A package is **an npm package or a local folder** that provides the browser side of one
or more `delta-*` tags. It builds on the existing `<import>` pack contract
([../src/compiler/imports.ts](../src/compiler/imports.ts),
[../examples/imports/mod/index.js](../examples/imports/mod/index.js)): a classic script
that calls `customElements.define("delta-foo", …)`.

### Manifest (optional)

A package *may* declare a manifest — a `"delta"` field in its `package.json`, or a
`delta.pack.json` beside its entry:

```jsonc
{
  "delta": {
    "tags": ["callout", "marginfig"],   // delta-* tags this pack owns
    "js":  "dist/pack.js",              // classic browser script (registers the tags)
    "css": "dist/pack.css",             // optional component stylesheet
    "needs": [],                         // other packages this one depends on
    "deltaVersion": ">=0.1"             // compatible Delta range
  }
}
```

**Backward compatible:** a folder with no manifest is the default manifest
`{ js: "index.js", css: "theme.css" }` — exactly today's convention. Existing
`<import src="folder/">` packs keep working unchanged.

`tags` is informational today but reserved for **tag-gating** (see below); `needs` lets a
pack depend on another so authors declare one and get both.

### Runtime-only, by design

A package's `js` is a **browser** script. The compiler **never** loads or runs package
code — it only reads the declared files and inlines them. This keeps two things small:

- **The offline guarantee.** Package files are inlined, never linked; an external
  reference inside one (`http(s)://`, `fetch(`, `import(`) is a warning, reusing the
  existing `EXTERNAL_REF` / `JS_EXTERNAL_REF` checks in `imports.ts` / `theme.ts`.
- **The trust surface.** A package can't reach into the build, the filesystem, or the
  pass pipeline. It's just markup-upgrading JS that runs in the reader's browser.

## How a package gets in: three channels, one inliner

All three resolve a package to an entry on `ctx.imports`
([../src/compiler/context.ts](../src/compiler/context.ts)). **`emit` is unchanged** — it
already inlines each import's CSS before the author theme and its JS after the runtime
([../src/compiler/emit.ts](../src/compiler/emit.ts)). That existing seam is the whole
reason this design is cheap.

| Channel | Form | Resolved from | Scope |
|---|---|---|---|
| Local import | `<import src="./packs/callout" />` | path, relative to the `.dlt` | the document |
| npm import | `<import src="delta-callout" />` | `node_modules` (bare specifier) | the document |
| Project manifest | `packages = ["delta-callout", "./packs/x"]` in `project.toml` | `node_modules` / relative to the toml | every file in the project |

The project-level `packages` list is the natural home for a real workflow: `npm install
delta-callout`, list it once in `project.toml`, and every chapter can use `<callout>`
without repeating `<import>`. It mirrors how a LaTeX preamble loads packages once for the
whole document.

Dedup is by absolute entry path (the `seen` set in `resolveImports` generalizes), so the
same package reached through two channels inlines once.

## On-demand granularity

Today's guarantee is **package-level**: a package is inlined when it is **declared**
(imported, or listed in `packages`). Declare it, you pay for it; don't, you don't. That
is the "inline only what's needed" promise at the grain that matters — optional features.

**Future refinement (not adopted yet): tag-gating.** Inline a *declared* package only if
one of its manifest `tags` actually appears in the document. This lets a project list a
broad set of packages in `project.toml` while each output carries only the ones its own
content uses. The manifest's `tags` field exists so this can be added later **without a
format change** — it's the one hook we're paying for up front.

## The `window.Delta` contract

Packages build against the runtime's public surface, exposed on `window.Delta`
([../src/runtime/index.ts](../src/runtime/index.ts)):

- `popover` — the shared pop-over controller (hovercards, ref previews).
- `t(key, fallback?)` — localized strings from the `#delta-i18n` island.
- `deck` — the presentation deck handle (or `null` off-deck).

This is the **stable, versioned API** for packs. Growing it is a deliberate decision;
packs must not reach into runtime internals (anything not on `window.Delta`), because
those can change between releases. A package that needs a capability the contract doesn't
offer is a signal to extend the contract, not to reach around it.

## What packages can't do (and what stays first-party)

A feature that needs **compile-time** work cannot be a third-party package today:

| Feature kind | Example | Ships as |
|---|---|---|
| Runtime-only: new tag rendered in the browser | a `<callout>` box, a layout primitive | **package** (npm / local / `<import>`) |
| Needs a compile-time pass | a new **numbered** environment, a new **reference kind**, a citation style | **first-party** (a row in [../src/compiler/environments.ts](../src/compiler/environments.ts) + a string + a runtime element) |

Adding a numbered environment is still a data-row edit in the compiler — see
[ARCHITECTURE.md](ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md). A third-party
**compiler-pass plugin** is **deferred**: it would mean loading and sandboxing Node code
in the build and committing the `CompileContext` shape and pass order as a public API — a
much larger, slower-to-stabilize surface than runtime-only packs. The door is open for a
later milestone; it is intentionally not part of this design.

## Where it lives in the code

The implementation lands entirely on existing seams:

- [../src/compiler/imports.ts](../src/compiler/imports.ts) — `resolvePack(spec, baseDir,
  ctx, seen, pos?)` is the shared resolver for **all** channels: it classifies the
  specifier (existing local folder vs bare `node_modules` specifier), reads the manifest
  (`package.json` `"delta"` → `delta.pack.json` → the `index.js`/`theme.css` convention),
  resolves `needs` dependency-first, dedups by absolute entry path (also the cycle guard),
  and pushes one `ImportEntry`. `resolveImports` is the thin `<import>` loop over it.
- [../src/compiler/config.ts](../src/compiler/config.ts) — `loadProjectConfig` parses the
  `packages` string array and records `root` (the toml's dir) as the resolution base.
- [../src/compiler/project.ts](../src/compiler/project.ts) — resolves `config.packages`
  once into a `pkgCtx`, then injects `pkgCtx.imports` into every file's `ctx.imports`
  before `resolveImports`, so each output inlines them and a file's own `<import>` of the
  same pack dedups.
- [../src/compiler/emit.ts](../src/compiler/emit.ts) — unchanged inlining; only the
  `/* pack: … */` debug marker now reads `ImportEntry.name` (pkg name / folder).

The single-file path ([../src/compiler/index.ts](../src/compiler/index.ts)) carries no
project config, so it sees only the `<import>` channel — including bare specifiers resolved
from the document's own `node_modules`.

## See also

- [ARCHITECTURE.md](ARCHITECTURE.md) — the pipeline and the compile-time/runtime split.
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to add a first-party feature.
- [BUILDING.md](BUILDING.md) — how the runtime and CSS are bundled into `assets.ts`.
