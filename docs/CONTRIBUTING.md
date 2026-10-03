# Contributing

This guide is about *adding functionality*. Read
[ARCHITECTURE.md](ARCHITECTURE.md) first — it explains the pipeline and the
concepts referenced below. Here we cover the dev workflow and the three shapes
every new feature takes, each with a worked example.

## Dev setup

Node 22.18 or newer (24 LTS is the one to pick): the sources run as TypeScript directly, with
no transpiler in between, which is what lets `node src/cli.ts` work. The published `delta`
command is compiled JavaScript and runs on Node 20.

```bash
npm install
npm test               # node --test (regenerates generated assets first)
npm run typecheck      # tsc --noEmit
npm run example        # compile examples/hello.dlt → out.html, open in a browser
npm run dev -- build path/to/doc.dlt -o out.html   # run the CLI from source
npm run build          # bundle runtime + CLI → dist/cli.js

node --test test/numbering.test.ts                      # one test file
node --test --test-name-pattern "resets across" test/   # one test by name
```

### The one gotcha: generated assets

The emitter imports `RUNTIME_JS`, `CORE_CSS` and `THEMES` from
`src/generated/assets.ts`, which is **generated and git-ignored**. It is produced
by `npm run assets` (`node scripts/build.ts assets`), which bundles the browser
runtime and concatenates the stylesheets under `src/styles/`.

Every npm script that needs it (`test`, `typecheck`, `example`, `dev`) has a pre-hook that
regenerates it, so you rarely think about it. But if you edit `src/runtime/` or anything
under `src/styles/` and then run `node --test`, `tsc` or `node src/cli.ts` **directly** (not
through npm), run `npm run assets` first or you'll see stale behavior or a missing-module
error.

The full build — the generated assets, the CLI bundle, and every npm script — is
documented in [BUILDING.md](BUILDING.md).

## Conventions

- **Style follows the file you are in**: 100-column lines, double quotes, semicolons, trailing
  commas, two-space indent. There is no formatter to run; keep a diff about what it changes.
- **ESM throughout**, `verbatimModuleSyntax` on — use `import type` for type-only
  imports.
- Relative imports always carry the **`.ts` extension** (`from "./ast.ts"`): Node runs the
  sources as they are and needs the real file name. `tsc` checks them
  (`allowImportingTsExtensions`); esbuild accepts them.
- Only TypeScript syntax that can be *erased* (`tsc` enforces `erasableSyntaxOnly`): type
  annotations, interfaces, `import type`. No `enum`, no `namespace`, no
  `constructor(private x)`; Node would refuse to run them.
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
- Every pass is `(doc, ctx) => void` in its own file under `src/compiler/`, registered as one
  row of the `PIPELINE` table. A pass that reads one of the author's files goes through
  `readUserFile` (records the dependency for `--watch`) and refuses URLs with `isRemote`.
- The output must reference **no external resources**. If a feature pulls in an
  asset (an image, a font), inline it as a `data:` URI. The
  `test/emit.test.ts` "references no external resources" test enforces this.

## The mental model: which of three shapes is your feature?

Every feature fits one of these. The deciding question is: **does this need data
the browser can't compute on its own, or just behavior?**

| Your feature needs… | Where it lives | Examples |
|---|---|---|
| Pure numbering | A row in [environments.ts](../src/language/environments.ts) + its family in [tags.ts](../src/language/tags.ts) | a new theorem-like environment |
| Data about *other* elements, resolved at compile time | A new pass + a `ctx` field, a step in [pipeline.ts](../src/compiler/pipeline.ts) | `<ref>`, table of contents, `<cite>`, bibliography, `<include>` |
| Only local browser behavior | A class in its own file under [src/runtime/elements/](../src/runtime/elements/) | collapsible sections, pop-over interaction |

The rule of thumb: **anything requiring knowledge of another element** (its number,
its content, where it sits in the document) **is a compile-time pass that reads or
writes `ctx.registry`** — because the browser can't `fetch` other files from
`file://`. Anything purely local (toggle, hover, click) is a runtime element.

---

## Shape 1 — a new numbered environment

Say you want `<remark>`, numbered alongside theorems.

1. **Add a row** to [environments.ts](../src/language/environments.ts):
   ```ts
   remark: { counter: "theorem", prefixWith: "section" },
   ```
   (Sharing the `theorem` counter makes remarks count *with* theorems. Give it its
   own counter name to count separately; `COUNTER_RESETS` is derived from `prefixWith`,
   so a section-prefixed counter restarts at each section with no further edit.)
2. **Name its family** in [tags.ts](../src/language/tags.ts): `RESULT_TAGS` if it is a
   statement that takes proofs and aids, otherwise `BOX_TAGS` (a bordered box with a
   floating label) or `PROOF_TAGS` (an inline italic lead). The runtime defines one element
   per tag from these sets, so `DeltaEnvironment` renders the right chrome automatically.
3. **Add the localized name** as a `remark` key in every block of
   [strings.ts](../src/language/strings.ts) (`en`, `pt`, …).
4. **Add `delta-remark`** to the two lists at the top of
   [components/theorems.css](../src/styles/components/theorems.css) (block display and the
   family tone). Box environments share `.box`/`.box-tag`, so nothing else is needed.
5. **Add a numbering test case** in [test/numbering.test.ts](../test/numbering.test.ts).

No pass code changes. [test/language.test.ts](../test/language.test.ts) fails if step 2, 3 or
4 is forgotten.

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
   ```
   Initialize it in `createContext`.

2. **Write the pass** — `src/compiler/references.ts`, exporting
   `resolveReferences(doc, ctx)`. Walk the AST with `elements(doc)`; for each
   `<ref to="X">`, look up `X` in `ctx.registry`. If found, fill the ref's display
   text with the number (e.g. "Theorem 1.1") and add `X` to `referencedIds`. If not
   found, `warn(ctx, …, el.pos)`.

3. **Wire it into the pipeline** ([pipeline.ts](../src/compiler/pipeline.ts)) — add a step
   to the `PIPELINE` table in the right phase: after `numberDocument` (it needs the registry
   populated) and before `emit`. The step name is the function name:
   ```ts
   { name: "resolveReferences", what: "<ref to> → data-target-num/tag from the registry", each: perFile(resolveReferences) },
   ```
   A step that needs project-wide state gets it as a third argument
   (`perFile((doc, ctx, shared) => …)`); one that runs once over all files uses `all`.
   `test/pipeline.test.ts` lists the steps literally, so update that list too — the order is
   a decision, and that list is where it is recorded.

4. **Teach the emitter** ([emit.ts](../src/compiler/emit.ts)) — after the body,
   `renderTemplates` emits every id in `ctx.referencedIds` (looked up in the project-wide
   `globalById`, so a target in another file works too) as
   `<template data-delta-pop="X">…</template>`. (Templates are inert in the DOM, so
   they cost nothing until cloned.)

5. **Add runtime behavior** ([ref.ts](../src/runtime/elements/ref.ts)) — a
   `DeltaRef` class that, on hover or click, finds the matching
   `<template data-delta-pop>` and clones its content into a pop-over. No `fetch`:
   the content is already on the page.

6. **Test** — a new `test/references.test.ts` asserting the ref text resolves and
   the template is emitted. The existing "no external resources" test keeps the
   offline guarantee honest.

7. **See it in the explorer** — `npm run docs` regenerates the site; your step appears in
   the pipeline explorer on `docs/compilador.html`, with the attributes it wrote highlighted.
   Give it a Portuguese description in `site/packs/pipeline/descriptions.json` (the generator
   warns when one is missing).

Every later cross-cutting feature is a variation on these six steps. A second worked
example is the collaboration family ([review.ts](../src/compiler/review.ts) +
[collab.ts](../src/compiler/collab.ts), design in [COLLABORATION.md](COLLABORATION.md)):
a validation pass that writes defaults, a numbering row per tag, a collector that builds
`ctx.review` and an island the runtime panel reads — and a `--final` pass that removes it
all for publication.

---

## Shape 3 — runtime-only behavior

Collapsible sections (ROADMAP item 8) need **no compiler changes at all**. Any
attribute on a `.dlt` tag flows through to the `<delta-*>` output verbatim, so the
compiler already passes `collapsible="true"` and `collapsed="true"` along — and this
is the canonical example of the shape, now shipped. The Portuguese tutorial for this shape
is [TUTORIAL_COMPONENTES.md](TUTORIAL_COMPONENTES.md).

The pattern: a small helper in [shared.ts](../src/runtime/elements/shared.ts) reads
`getAttribute("collapsible")`, wires a click/keydown handler on the element's existing
label, and toggles a class the CSS responds to. `applyCollapsible(host, label)` does
exactly this — it moves the label's following siblings into a `.collapse-body` (so even
loose text folds) and toggles `.is-collapsed`; `DeltaSection`/`DeltaEnvironment` call it
with their heading / box tag / proof lead. The styles live in
[components/collapse.css](../src/styles/components/collapse.css) (`@layer delta.components`),
and the new element/behavior is registered in `defineComponents`.

Before writing chrome by hand, check [shared.ts](../src/runtime/elements/shared.ts): it
already has the pieces most elements need, and using them keeps every element behaving
the same way.

| Helper | What it does |
|---|---|
| `kindOf(el)` | `delta-theorem` → `theorem` |
| `button(cls, …content)` | a `<button type="button">` |
| `takeTitle(host)` | removes the `<delta-title>`, returns its nodes (math intact) and its spoken text |
| `numberedName(kind, num)` | "Figure 1.2", "Teorema 3" (localized) |
| `renderMeta(host)` | the `<meta>` key/value row |
| `jumpTo(id)`, `linkJump(a, id, file)` | go to a target the Delta way: deck page, unfold, scroll, flash; cross-file navigates |
| `templateFor(id)` | the pop-over snapshot the compiler shipped for `id` |
| `copyButton(cls, label, text)` | a Copy button with the "Copied" feedback |
| `applyCollapsible`, `applyStatus` | folding; the status/author pill |

Localized text goes through `t(key, fallback)` or `nameOf(tag)` from
[i18n.ts](../src/runtime/i18n.ts), never a literal; JSON islands are read with
`readIsland` ([island.ts](../src/runtime/island.ts)). Register a single-tag element with its
class directly (`customElements.define("delta-quote", DeltaQuote)`); only a class shared by
several tags needs `class extends …{}` per tag. The order elements are registered in matters
in three places, listed at the top of [elements/index.ts](../src/runtime/elements/index.ts).

Reach for this shape whenever the behavior is local to one element and needs no
knowledge the browser doesn't already have.

---

## Testing

Tests live in [test/](../test/) and mirror the passes. Patterns to follow:

- **Pass tests** drive one pass by hand: `parsed(src)` or `numbered(src)` from
  [test/helpers.ts](../test/helpers.ts) give you a tree and a context, you call the pass,
  then assert on the resulting AST (`num` attributes, registry entries) or on diagnostics.
  See [test/numbering.test.ts](../test/numbering.test.ts).
- **Emitter tests** call `compile(src)` (the whole pipeline) and assert on the HTML string —
  including the invariant that it references no external resources. See
  [test/emit.test.ts](../test/emit.test.ts).
- **Architecture tests** live in [test/pipeline.test.ts](../test/pipeline.test.ts): the step
  order, "a single file equals a project of one file", the trace hook and `stopAfter`.
  [test/language.test.ts](../test/language.test.ts) checks that the vocabulary agrees with
  itself, the strings and the CSS.
- **Runtime tests** live in [test/runtime/](../test/runtime/) and run in the machine's
  Chromium (through [test/browser.ts](../test/browser.ts); they skip when none can start):
  `inspect(dlt, script)` from [test/runtime/helpers.ts](../test/runtime/helpers.ts) compiles
  the document, loads it headless, runs `script` inside the page and returns what it
  returns. The script reads and does what the reader would: `text(".box-tag")`,
  `click(".collapse-toggle")`, `key("Escape")`, `openPopover()`. A launch costs about a
  second, so a suite runs one script per document and its `it`s assert on fields of the
  result (`lazy()`). See [test/runtime/references.test.ts](../test/runtime/references.test.ts).
  [test/hittest.test.ts](../test/hittest.test.ts) and `overflow.test.ts` use the same browser
  for what only a layout engine can tell (what is under the mouse, what overflows on a phone).

When you add a pass, add a matching test file. When you add a numbered environment,
add a numbering case. When you add or change a runtime element, add a case to the
matching file in `test/runtime/`.

## The roadmap

[ROADMAP.md](../ROADMAP.md) lists the planned features in dependency order, grouped
into milestones (core loop → media → bibliography → multi-file → theming → polish).
Pick the lowest unchecked item in the milestone you care about — earlier items tend
to be prerequisites for later ones (e.g. the registry built in numbering is what refs
and citations consume). Check items off as you land them.
