# Contributing

This guide is about *adding functionality*. Read
[ARCHITECTURE.md](ARCHITECTURE.md) first — it explains the pipeline and the
concepts referenced below. Here we cover the dev workflow and the three shapes
every new feature takes, each with a worked example.

## Dev setup

```bash
npm install
npm test               # vitest (regenerates generated assets first)
npm run typecheck      # tsc --noEmit
npm run example        # compile examples/hello.dlt → out.html, open in a browser
npm run dev -- build path/to/doc.dlt -o out.html   # run the CLI from source
npm run build          # bundle runtime + CLI → dist/cli.js

npx vitest run test/numbering.test.ts   # one test file
npx vitest run -t "resets across"       # one test by name
```

### The one gotcha: generated assets

The emitter imports `RUNTIME_JS`, `CORE_CSS` and `THEMES` from
`src/generated/assets.ts`, which is **generated and git-ignored**. It is produced
by `npm run assets` (`tsx scripts/build.ts assets`), which bundles the browser
runtime and concatenates the stylesheets under `src/styles/`.

Every npm script that needs it (`test`, `typecheck`, `example`, `dev`) has a
pre-hook that regenerates it, so you rarely think about it. But if you edit
`src/runtime/` or anything under `src/styles/` and then run `vitest` or `tsc`
**directly** (not through npm), run `npm run assets` first or you'll see stale
behavior or a missing-module error.

The full build — the generated assets, the CLI bundle, and every npm script — is
documented in [BUILDING.md](BUILDING.md).

## Conventions

- **ESM throughout**, `verbatimModuleSyntax` on — use `import type` for type-only
  imports.
- Relative imports are **extension-less** (tsx / esbuild / vitest resolve them).
- CSS is namespaced `--delta-*` and lives under [src/styles/](../src/styles/) in
  three cascade layers (declared once at the top of
  [base.css](../src/styles/base.css)): `delta.base` (tokens, page grid, shared
  primitives), `delta.components` (Delta's chrome, one file per feature under
  `components/`), and `delta.theme` (per-document-type token overrides under
  `themes/`, selected by `<document type="…">`). Theming means overriding the
  `--delta-*` tokens; the theme layer always wins over base and components, so a
  theme only needs to restate the few variables it changes. New components style
  with **classes** in their own `components/<name>.css`.
- Diagnostics, not exceptions: report problems with `error(ctx, msg, pos)` /
  `warn(ctx, msg, pos)` so the CLI can print them with source positions. Reserve
  thrown errors for genuinely unexpected states.
- The output must reference **no external resources**. If a feature pulls in an
  asset (an image, a font), inline it as a `data:` URI. The
  `test/emit.test.ts` "references no external resources" test enforces this.

## The mental model: which of three shapes is your feature?

Every feature fits one of these. The deciding question is: **does this need data
the browser can't compute on its own, or just behavior?**

| Your feature needs… | Where it lives | Examples |
|---|---|---|
| Pure numbering | A row in [environments.ts](../src/compiler/environments.ts) | a new theorem-like environment |
| Data about *other* elements, resolved at compile time | A new pass + a `ctx` field, wired into [index.ts](../src/compiler/index.ts) | `<ref>`, table of contents, `<cite>`, bibliography, `<include>` |
| Only local browser behavior | A class in its own file under [src/runtime/elements/](../src/runtime/elements/) | collapsible sections, pop-over interaction |

The rule of thumb: **anything requiring knowledge of another element** (its number,
its content, where it sits in the document) **is a compile-time pass that reads or
writes `ctx.registry`** — because the browser can't `fetch` other files from
`file://`. Anything purely local (toggle, hover, click) is a runtime element.

---

## Shape 1 — a new numbered environment

Say you want `<remark>`, numbered alongside theorems.

1. **Add a row** to [environments.ts](../src/compiler/environments.ts):
   ```ts
   remark: { counter: "theorem", prefixWith: "section" },
   ```
   (Sharing the `theorem` counter makes remarks count *with* theorems. Give it its
   own counter name to count separately, and add that counter to the relevant
   `COUNTER_RESETS` entry if it should reset per section.)
2. **Add it to `ENVIRONMENT_TAGS`** in [environment.ts](../src/runtime/elements/environment.ts), and to
   `BOX_ENVIRONMENTS` (a bordered `.box` with a floating label tag) or `PROOF_ENVIRONMENTS`
   (an inline italic lead). `DeltaEnvironment` then renders the right chrome automatically.
3. **Add the localized name** as a `remark` key in every block of
   [strings.ts](../src/compiler/strings.ts) (`en`, `pt`, …). Without it the runtime
   falls back to the capitalized tag (`"Remark"`), so this is what makes the label
   translate; the seeded `en` value is also the fallback.
4. **Styling is usually automatic** — box environments share `.box`/`.box-tag` in
   [components/theorems.css](../src/styles/components/theorems.css). Add rules there only for a
   bespoke look.
5. **Add a numbering test case** in [test/numbering.test.ts](../test/numbering.test.ts).

No pass code changes. That's the point of the data-driven table.

---

## Shape 2 — a new compile-time pass

This is the big one, and `<ref>` pop-overs (ROADMAP item 6) is the canonical
example. The shape here is reused by citations, TOC, bibliography and includes, so
learn it once.

The flow is always: **extend `ctx` → write the pass → wire it into the orchestrator
→ teach the emitter → add runtime behavior → test.**

1. **Extend the context** ([context.ts](../src/compiler/context.ts)) — add the
   state the pass needs to hand to the emitter:
   ```ts
   referencedIds: Set<string>;          // which targets are referenced
   templates: Map<string, string>;      // id → snapshot HTML for the pop-over
   ```
   Initialize them in `createContext`.

2. **Write the pass** — `src/compiler/references.ts`, exporting
   `resolveReferences(doc, ctx)`. Walk the AST with `elements(doc)`; for each
   `<ref to="X">`, look up `X` in `ctx.registry`. If found, fill the ref's display
   text with the number (e.g. "Theorem 1.1") and add `X` to `referencedIds`. If not
   found, `warn(ctx, …, el.pos)`.

3. **Wire it into the pipeline** ([index.ts](../src/compiler/index.ts)) — after
   `numberDocument` (it needs the registry populated) and before `emit`:
   ```ts
   numberDocument(doc, ctx);
   renderMath(doc, ctx);
   resolveReferences(doc, ctx);
   return emit(doc, ctx);
   ```

4. **Teach the emitter** ([emit.ts](../src/compiler/emit.ts)) — when `serialize()`
   reaches an element whose `id` is in `ctx.referencedIds`, also store its serialized
   HTML in `ctx.templates`. After the body, emit each entry as
   `<template data-delta-pop="X">…</template>`. (Templates are inert in the DOM, so
   they cost nothing until cloned.)

5. **Add runtime behavior** ([ref.ts](../src/runtime/elements/ref.ts)) — a
   `DeltaRef` class that, on hover or click, finds the matching
   `<template data-delta-pop>` and clones its content into a pop-over. No `fetch`:
   the content is already on the page.

6. **Test** — a new `test/references.test.ts` asserting the ref text resolves and
   the template is emitted. The existing "no external resources" test keeps the
   offline guarantee honest.

Every later cross-cutting feature is a variation on these six steps.

---

## Shape 3 — runtime-only behavior

Collapsible sections (ROADMAP item 8) need **no compiler changes at all**. Any
attribute on a `.dlt` tag flows through to the `<delta-*>` output verbatim, so the
compiler already passes `collapsible="true"` and `collapsed="true"` along — and this
is the canonical example of the shape, now shipped.

The pattern: a small helper in [shared.ts](../src/runtime/elements/shared.ts) reads
`getAttribute("collapsible")`, wires a click/keydown handler on the element's existing
label, and toggles a class the CSS responds to. `applyCollapsible(host, label)` does
exactly this — it moves the label's following siblings into a `.collapse-body` (so even
loose text folds) and toggles `.is-collapsed`; `DeltaSection`/`DeltaEnvironment` call it
with their heading / box tag / proof lead. The styles live in
[components/collapse.css](../src/styles/components/collapse.css) (`@layer delta.components`),
and the new element/behavior is registered in `defineComponents`.

Reach for this shape whenever the behavior is local to one element and needs no
knowledge the browser doesn't already have.

---

## Testing

Tests live in [test/](../test/) and mirror the passes. Patterns to follow:

- **Pass tests** drive the pipeline directly: `preprocess` → `parse` → the pass under
  test, then assert on the resulting AST (`num` attributes, registry entries) or on
  diagnostics. See [test/numbering.test.ts](../test/numbering.test.ts).
- **Emitter tests** call `compileSource` and assert on the HTML string — including the
  invariant that it references no external resources. See
  [test/emit.test.ts](../test/emit.test.ts).

When you add a pass, add a matching test file. When you add a numbered environment,
add a numbering case.

## The roadmap

[ROADMAP.md](../ROADMAP.md) lists the planned features in dependency order, grouped
into milestones (core loop → media → bibliography → multi-file → theming → polish).
Pick the lowest unchecked item in the milestone you care about — earlier items tend
to be prerequisites for later ones (e.g. the registry built in numbering is what refs
and citations consume). Check items off as you land them.
