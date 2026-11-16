# Delta — maintainability review and implementation plan

## Context

Delta is growing (≈19k lines, 375 commits, a dozen student contributors). The maintainer asked
three things: is the codebase healthy, is it heading somewhere maintainable, and how can
components written as **packs** (the student's plot system in particular) come upstream.

This document is the answer and the handoff. It is written so that **another agent can
implement it without this conversation**: every work package (WP) says why it exists, with
`file:line` evidence, what to change, and how to know it is done.

Decisions taken by the maintainer on 2026-11-16:

1. First-party packs live in a top-level `packs/` folder, ship inside the CLI, and are loaded
   **automatically when a document uses one of their tags**.
2. This plan builds **the mechanism only**, with one tiny example pack. The student packs
   (plot, question, AI-use) are ported later by their authors, using the checklist in §3.6.
3. CI runs the tests and **publishes the site**; `docs/*.html` leaves git.
4. **Standard packs are TypeScript, enforced**: the same strict `tsconfig.json` as core, no
   `.js` sources in `packs/`. Local and npm packs stay free-form classic scripts.

**Status.** Nothing here is implemented yet. Progress is tracked in milestone M10 of
[ROADMAP.md](../ROADMAP.md), one checkbox per WP; check an item off in the PR that lands it.
Line numbers refer to branch `refactor/mantainability` at commit `54df109` (2026-11-16);
re-locate by symbol name if the code has moved.

## 1. Verdict

**The codebase is healthy.** What is good and must be kept:

- One declared pipeline (`src/compiler/pipeline.ts`, 35 steps in 6 phases), pinned by a test.
- A generic three-node AST; diagnostics instead of exceptions; zero `any`, zero `@ts-ignore`.
- A vocabulary layer (`src/language/`) that both halves import.
- One uniform runtime recipe: light-DOM `HTMLElement`, `connectedCallback` with the
  `deltaReady` guard, one `defineX()` per file, one ordered registration table whose three
  constraints are written down (`src/runtime/elements/index.ts:1-22`).
- One popover controller, one island reader, colours almost entirely through tokens.
- 486 tests, and developer docs that are unusually good.

**The direction has six risks**, all at the seams, not inside modules:

| # | Risk | Evidence |
|---|---|---|
| 1 | The documented student path is "write a core element", but students write **packs**, and packs have no upstream home, so their work stays on branches. | `origin/feature/plot` (21 commits since September), `origin/question-component`, `origin/feat/declaracao-uso-ia`, `origin/feature/convex-hull`: four packs in four ad hoc folders, two manifest styles, none merged. |
| 2 | No safety net around contributions. | No `.github/`. Browser suites skip silently without Chromium. 19 MB of built HTML is committed, so a one-component PR shows thousands of changed lines. `src/generated/assets.ts` on disk today comes from another branch (it exports `HAND_CSS`, which this branch's `scripts/build.ts` never writes). |
| 3 | The compiler→runtime contract is undeclared. | ≈25 `data-*` names and 3 island ids are string literals on both sides. Island payload types exist twice (`emit.ts:162-230` vs `runtime/elements/toc.ts:19`, `collab.ts:39-65`). `data-cite-num` (`bibliography.ts:87`) is written and never read. |
| 4 | Component CSS depends on file names. | `scripts/build.ts:42-45` concatenates `components/*.css` alphabetically inside one layer. Commit `23a2101` fixed one such bug by adding `delta.shells`; `reference.css:122-137` still wins by specificity bumps; `docs/BUILDING.md:43-45` says order does not matter. |
| 5 | Runtime helpers are hard to find and partly triplicated. | `utils.ts` is only the popover. `elements/shared.ts` has 15 exports over five concerns. `elements/{status,collab,aid}.ts` register no element. Three fold implementations (`shared.ts:230`, `aid.ts:94`, `proofstructure.ts:86-130`). `shared.ts` ↔ `address.ts` import each other. |
| 6 | The compiler has drifted from its own rules. | 13 hand-written tree walkers with five skip policies. 7 local tag sets outside `src/language/`. 8 steps with logic inline in the `PIPELINE` table. Single-file and project builds disagree on failure (`index.ts:75` vs `project.ts:64-73`). `ARCHITECTURE.md:91` omits `linkRemoteProofs`. |

Risk 1 answers the plot question, so it gets the most detail (§3).

## 2. Ground rules for the implementer

Standing decisions of the maintainer. Follow them in every WP.

- **Academic project.** Students contribute; code must stay readable by them. Prefer plain
  data tables and small functions over abstractions. No framework, no base class, no new
  runtime dependency (the published CLI depends only on `katex`; `esbuild` is dev-only).
- **Keep the compiler small.** No new pipeline step in this plan. `PIPELINE` order and step
  names are pinned by `test/pipeline.test.ts:61-98`; a changed `what` also needs its pt-BR
  line in `site/packs/pipeline/descriptions.json`.
- **Rule 1 stays:** the compiler resolves data, the runtime draws chrome. **Rule 2 stays:**
  the output references nothing external.
- **Core stays monolithic** (`docs/PACKAGES.md:36-64`). Output size (~1 MB per file) is
  accepted; do not trim fonts or CSS.
- **Colours are semantic tokens** in `src/styles/base.css`; none hard-coded in components.
- **Docs:** user-facing pages are pt-BR on the site (`site/*.dlt`); developer docs are English
  in `docs/*.md`. Update both in the same PR as the code.
- **Runtime checks test what is painted** (visibility, pixels, hit-testing), not only state.
- **Do not touch student branches.** Read them with `git show`; never check them out.
- **One WP = one PR**, behaviour-preserving unless the WP says otherwise. Do not commit unless
  asked. Run the golden check of §8 before and after every refactor.
- **One ordering constraint:** `feature/animation` (one commit ahead of `main`; touches
  `src/runtime/{deck,elements/index,elements/list,elements/media}.ts`) must be merged before
  WP-R1 moves runtime files.

## 3. Phase 1 — packs upstream (the plot question)

### Why this design

A pack today is a classic script pasted after the runtime. Its only link to core is
`window.Delta = { popover, t, deck, review }` (`src/runtime/index.ts:33`). The plot pack's
"complex architecture" (17 scripts, 7 manifests, a 10-entry `needs` list, 59 implicit globals)
is mostly a workaround for one missing thing: **packs have no module system**. The student
rebuilt one out of folders and load order.

Three routes were compared:

- *Move the plot into the core runtime.* Rejected: ≈1,350 lines inlined into every document, a
  `new Function` in core, and one more entry in the order-sensitive registration table. Plot
  needs nothing from the compiler; numbering comes from wrapping it in the existing
  `<interactive>`.
- *Keep classic scripts and concatenate the `needs` chain at build time.* Zero edits and the
  same output size, but it freezes an implicit-globals module system that no editor or linter
  understands, and the expression parser stays untestable outside a browser.
- **Standard packs (chosen).** A pack keeps its own internal architecture, written as
  TypeScript modules in its own folder. The Delta build bundles it; the compiler inlines it on
  demand. Delta already does exactly this for themes: `src/styles/builtin/*.css` →
  `BUILTIN_THEMES` → `<document theme="impatech">` (`scripts/build.ts:49-62`,
  `src/compiler/theme.ts`). And `delta create package` already builds third-party packs with
  `--bundle --format=iife` (`src/scaffold.ts:79-80`).

The module structure was checked on a simulated port of the plot (add `export`s and imports,
nothing else, still JavaScript), bundled in memory: 59 names in 17 files, an acyclic import
graph, zero warnings, ≈22 KB. See Appendix A. Typing it for strict TypeScript is additional
work for its author and was not simulated.

The result is three tiers with **one contract** (`window.Delta`) for every pack:

| Tier | Where | Loaded | Written as | For |
|---|---|---|---|---|
| Core | `src/runtime/elements/` | always | TS strict | what needs compile-time data (numbering, refs, ToC) |
| Standard pack | `packs/<name>/` | when its tag is used | TS strict, same `tsconfig.json` | optional components shipped with Delta — **where students contribute** |
| Local / npm pack | author's folder, `node_modules` | when declared | one classic script, any source | prototypes and third parties (unchanged) |

Promotion path: local pack (a JavaScript prototype is fine) → standard pack (a PR adding one
TypeScript folder) → core (rare, and by then nearly a file move, because the code standard is
already the same).

**A dissent to know about.** The independent design review preferred an explicit
`<import src="delta:plot"/>` over automatic loading, because a new standard pack changes what
its tag means in documents that already exist (`theme.ts:31-36` states the opposite principle
for themes). The maintainer chose automatic. WP-P2 and WP-P4 carry the mitigations. An explicit
form can be added later in ≈20 lines of `resolvePack` and conflicts with nothing here.

### WP-P1 — build standard packs into the CLI

- `scripts/build.ts`: for each `packs/<name>/delta.pack.json`, bundle its entry (`index.ts`
  unless the manifest's `js` names another `.ts` file) with esbuild (the runtime's options at
  `:65-72`, plus `metafile: true`), read its `css` and its `strings` file if any, and write
  `BUILTIN_PACKS: Record<string, { js: string; css?: string; tags: string[]; strings?: Record<string, Record<string, string>> }>`
  into `src/generated/assets.ts`, next to `BUILTIN_THEMES`. About 25 lines.
- Throw when a bundle's `metafile.inputs` has a path outside `packs/<name>/`. *Why:* core
  helpers hold module singletons (the one-open-popover rule at `utils.ts:57`, the caches at
  `island.ts:7` and `shared.ts:83`); bundled into a pack they would exist twice.
- `build.ts` must not import anything under `src/compiler/`: `imports.ts:6` → `theme.ts:5` →
  `generated/assets.ts`, which does not exist on a fresh checkout.
- **TypeScript is enforced three ways.** (1) `tsconfig.json`: add `packs` to `include`, so
  `npm run typecheck` (and CI, WP-S1) checks packs under core's rules: `strict`,
  `erasableSyntaxOnly`, `verbatimModuleSyntax`, imports written with the `.ts` extension. Do
  not turn on `allowJs`. (2) `build.ts` throws when an entry is not a `.ts` file. (3)
  `test/packs.test.ts` (WP-P4) fails when any `.js`, `.mjs` or `.cjs` file exists under
  `packs/`, and when a pack source contains `any` or `@ts-ignore` (core has none).
- Packs see `window.Delta` typed without importing anything: the `declare global` at
  `src/runtime/index.ts:9-19` is in the same TypeScript program. A type-only import from
  `src/` is erased and does not trip the folder check; a value import does.
- `package.json` and `.gitignore` need nothing: `assets.ts` is bundled into `dist/cli.js`.
- Docs: `docs/BUILDING.md`, the file map in `docs/ARCHITECTURE.md`.
- Done when: `npm run assets` emits `BUILTIN_PACKS`; a pack that imports `../../src/…` as a
  value fails the build with a message naming the file; a type error in a pack fails
  `npm run typecheck`.

### WP-P2 — load a standard pack when its tag is used

Do it in **emit**, the way KaTeX CSS is gated by `ctx.mathUsed` (`emit.ts:72,149,165,194`).

- `serialize` (`emit.ts:262-279`) is the only place that writes `delta-${tag}`. Have it record
  every tag in a `Set<string>`. That set covers the body **and** what emit copies from other
  files: pop-over templates (`:133-150`), project ToC titles (`:170`), review bodies
  (`:217-226`). A walk of `doc` in `resolveImports` would miss those three.
- New function in `src/compiler/imports.ts`:
  `standardPacksFor(usedTags, explicit, table = BUILTIN_PACKS): ImportEntry[]`. It returns the
  packs with a used tag, skipping a pack when an explicitly declared pack already registers
  one of its tags (match `customElements.define("delta-<tag>"` in the explicit pack's JS; this
  regex matched every pack in the repo). The defaulted `table` lets tests pass a fake.
- `emit` uses `[...ctx.imports, ...standardPacksFor(…)]` for the `<style>`s, the `<script>`s
  and the strings. **Standard packs go last**, so a collision the regex missed throws inside
  the standard pack's own script and the author's pack keeps working.
- `ImportEntry.source` (`context.ts:42`) is `delta:<name>` for these; no `addDep`.
- No new step. Reword the `what` of `emit` (`pipeline.ts:404`) and its line in
  `descriptions.json`. Document the semantics in `docs/PACKAGES.md:147-157`. ROADMAP item 48
  (gating *declared* third-party packs) stays open; note that standard packs are gated.
- Fix on the way: `imports.ts:107` passes `pos` into nested `needs`, so two packs needing the
  same library print a false "already imported" warning (`:100-101`). Pass `undefined`.
- Done when: a document using the example tag gets that pack's JS and CSS; a document without
  it is byte-identical to today; a tag that appears only inside another file's pop-over
  snapshot still loads the pack; the offline guard in `test/emit.test.ts` passes.

### WP-P3 — localized strings for packs; grow `window.Delta` only on demand

- Manifest field `strings`: a JSON file `{ "en": {…}, "pt": {…} }`, accepted by
  `normalizeManifest` (`imports.ts:189-197`) and carried on `ImportEntry`. At `emit.ts:43` the
  island becomes `{ ...packStrings, ...strings }`, so core keys win. Keys start with
  `<pack>.`. It works for local, npm and standard packs alike. *Why:* a pack cannot add i18n
  keys today (`docs/AUTHORING_PACKAGES.md:155`), which is why plot and question hard-code
  Portuguese and AI-use ships Portuguese fallbacks only.
- Do **not** add members to `window.Delta` now: each one is permanent
  (`docs/PACKAGES.md:170-173`). Candidates, to add when a ported pack needs one: `version`
  (the docs call the API "versioned" but nothing carries a version, and `deltaVersion` is
  parsed and ignored), `takeTitle`, `button`, `nameOf`.
- Move the `declare global { interface Window { Delta … } }` block out of
  `src/runtime/index.ts:9-19` into its own file, `src/runtime/api.ts`, with one doc comment
  per member. It is then the single typed statement of the contract that standard packs
  compile against.
- Reword `docs/AUTHORING_PACKAGES.md:132-135,257` and `src/scaffold.ts:93`: "no
  import/export" applies to the **shipped** script; sources may be modules that are bundled.
- Docs: `docs/AUTHORING_PACKAGES.md` (manifest table, the `Delta.t` row), `site/api.dlt`.
- Done when: a test shows a pack label switching between `lang="en"` and `lang="pt-BR"`, and
  the island is byte-identical when no pack has strings.

### WP-P4 — invariants, the example pack, the checklist

- `test/packs.test.ts` (Node, data-driven, like `test/theme.test.ts:144` for built-in themes).
  For every standard pack:
  - every source file is `.ts`, with no `any` and no `@ts-ignore`;
  - `tags` is non-empty and no two packs share a tag;
  - the `customElements.define("delta-…")` literals in the bundle equal `tags` exactly;
  - no tag is registered by core (`RUNTIME_JS`) or styled by core (`CORE_CSS`);
  - `strings` has the same key set in every language, each key prefixed `<name>.`;
  - JS and CSS pass the external-reference regexes (`imports.ts:9`, `theme.ts:26`), and the
    CSS has no hard-coded colour.
- `packs/example/`: `delta.pack.json` (`{"tags": ["pack-example"]}`), `index.ts` importing
  one sibling `.ts` module, `theme.css` on `--delta-*` tokens only, `strings.json`, `README.md`. It
  is the template students copy and the fixture for the browser test. Keep the manifest as
  `delta.pack.json`; a nested `package.json` would change the folder's module type.
- `test/packs/example.test.ts` with `inspect()` (`test/runtime/helpers.ts`): the element
  upgrades, is visible, shows the localized label.
- Cases in `test/imports.test.ts` and `test/emit.test.ts` using a fake table, and in
  `test/deps.test.ts` (a standard pack adds no dependency, like the built-in theme at `:30-38`).
- Developer loop to document: `npm run dev -- build <demo>.dlt` rebuilds the packs each time
  (`predev` runs `assets`). `--watch` does not see pack edits, because the CLI loads
  `assets.ts` once.
- `packs/README.md` holds the checklist of §3.6. Put the same in pt-BR in
  `docs/TUTORIAL_COMPONENTES.md`, replacing the "pack → core" section (`:645-668`) with the
  three-tier path, and update "which shape is your feature" in `docs/CONTRIBUTING.md:73-90`.

### 3.6 Admission checklist for a pack entering `packs/`

1. One folder, one `delta.pack.json`. **TypeScript only**, passing `npm run typecheck` under
   the repo's `tsconfig.json`, with no `any` and no `@ts-ignore`. Internal files use
   `import`/`export`. No `needs`, no sub-manifests, nothing left on `window`.
2. It registers **exactly** the tags in `tags`, normally one root element. Children are plain
   unregistered elements that the root reads (`:scope > delta-point`), as core does for
   `<column>` (`src/runtime/elements/columns.ts:18-22`). Never register a generic name
   (`point`, `option`, `title`, `date`, `link`).
3. The entry registers its elements explicitly and in order, like `defineComponents()`.
4. No expando that shadows a DOM property (`title`, `hidden`, `id`, `style`); keep state in
   one object on the element.
5. Every visible string through `Delta.t("<pack>.key", fallback)`, keys in `strings.json`.
6. CSS: selectors scoped under the root tag, existing `--delta-*` tokens only, correct with
   `theme-mode="dark"`.
7. Keyboard reachable, visible focus ring, accessible names on canvases and icon buttons.
8. No `fetch`, no URL, no `eval`. `new Function` over a whitelisted grammar is tolerated, with
   unit tests for hostile input.
9. One browser test in `test/packs/`, unit tests for pure logic, one demo page on the site.
10. No compiled HTML in the PR.

Port notes for the student packs (for their authors; not work of this plan):

- **All three** are JavaScript today and must be converted to TypeScript on entry. The main
  typing work is the state each pack hangs on its elements as untyped expandos (for the plot:
  `plot.header`, `plot.canvas`, `plot.data`, `plot.elements`); declare it as typed class
  fields or one typed state object.
- **plot** (`origin/feature/plot`, `examples/example-plot/packages/plot/`). Appendix A gives
  the import graph. Beyond adding imports and exports: register only `delta-plot` and turn the
  six child classes into plain layers; `actions/index.js:92,99,118` create children with
  `document.createElement` and `index.js:14-16` then calls `el.build(this)`, so today the
  order of definition is load-bearing. Read `<title>` in `collectPlotSubcomponents`
  (`actions/index.js:83-87`) with `plot.querySelector(":scope > delta-title")` and move its
  `childNodes` into the header so math survives. Drop `plot.title = text`
  (`subcomponents/title/actions/index.js:10`): it sets the tooltip of the whole plot. Replace
  `--delta-surface-0` → `--delta-paper` and `--delta-font-body` → `--delta-sans` (the two
  names do not exist, so dark mode shows a white canvas) and the `#ffffff` at
  `points/actions/index.js:222-224`. Restore the focus outline removed at `theme.css:14-21`.
  Use `Object.hasOwn` instead of `in` at `factory/index.js:62`. Remove the `document`
  listener added per plot at `points/actions/index.js:321` in `disconnectedCallback`.
- **question** (`origin/question-component`): one file, close to drop-in. It registers the
  generic `delta-option`; apply rule 2. Strings and tokens.
- **AI-use** (`origin/feat/declaracao-uso-ia`): already uses `Delta.t` and `Delta.popover`.
  Its manifest lists `date` and `link`, which core registers (`frontmatter.ts:33,77`,
  `link.ts:27`); as triggers they would load it into almost every document. Reduce `tags` to
  `["ai-use"]` and move the fallbacks into `strings.json`.

## 4. Phase 0 — safety nets (do first; all small)

### WP-S1 — CI
`.github/workflows/ci.yml` on pull requests and pushes to `main`: Node from `.node-version`,
`npm ci`, `npm run typecheck`, `npm test`. GitHub's Ubuntu image ships Chrome, which
`test/browser.ts:15` already looks for. Change `test/browser.ts:47-48` so that when `CI` is
set and no browser launches the run **fails** instead of skipping. *Why:* nothing runs the 67
runtime tests today unless the contributor happens to have Chromium.

### WP-S2 — publish the site from CI
`.github/workflows/pages.yml` on pushes to `main`: `npm ci && npm run docs`, upload `docs/` as
the Pages artifact, deploy. Then `git rm --cached` `docs/*.html` and `docs/exemplos/`, ignore
them, and fix the two places that say the HTML is versioned (`site/project.toml:6-7`,
`README.md:74-83`). The maintainer switches *Settings → Pages → Source* to "GitHub Actions".
*Why:* the AI-use branch is 5 source files and 23 changed files, 6,186 lines.

### WP-S3 — stale generated assets
Make `scripts/build.ts` export the function that renders `assets.ts` (guard the top-level
`await` so importing it builds nothing) and add `test/assets.test.ts` comparing its result
with the file on disk; on mismatch fail with "run `npm run assets`". *Why:* `npm test`
rebuilds, but `node --test`, `tsc` and editors use whatever the previous branch left behind.

### WP-S4 — dead weight and doc drift
- Delete: `test/fixtures/theme-builtin.html` and `theme-dep.html` (≈500 KB each, unused);
  `COLLAB_TAGS` (`tags.ts:79`); the `data-cite-num` write (`bibliography.ts:87`);
  `resolveCitations` (`bibliography.ts:28`, test-only: port its tests to `compile()`).
- Fix docs: `ARCHITECTURE.md:91` (add `linkRemoteProofs`) and `:205` ("one element per
  file"); `descriptions.json` (same step missing; `scripts/trace.ts:139` warns);
  `CONTRIBUTING.md:55-60,194` and `TUTORIAL_COMPONENTES.md:566` (three layers → six, with
  `delta.shells`); `BUILDING.md:43-45`; `PACKAGES.md:46` (re-measure the size table) and
  `:203-206` (`pkgCtx` no longer exists); `AUTHORING_PACKAGES.md:86-89`; `ROADMAP.md:3,15,
  168,218`; stale comments at `bibliography.ts:22`, `collab.ts:10`, `final.ts:25`, `ast.ts:7`,
  `runtime/elements/ref.ts:144`.
- Guard: `test/docs.test.ts` asserts that every `PIPELINE` step name appears in
  `docs/ARCHITECTURE.md` and has an entry in `descriptions.json`.

### WP-S5 — formatter (optional; maintainer's call)
Prettier with `printWidth: 100` and a `format:check` in CI. `CONTRIBUTING.md` asks for 100
columns and ≈65 lines exceed it. *Why:* one formatting commit ends style review on student PRs.

## 5. Phase 2 — runtime, where students work

### WP-R1 — a folder layout that tells the truth (moves only)
*Why:* a student looking for a helper has to know that `utils.ts` is the popover and that
`applyStatus`, `memberChip` and `buildFolds` live in element-named files.
Rule: **`elements/` holds files that register tags; everything else in `src/runtime/` is
shared library.**
- `utils.ts` → `popover.ts`.
- `elements/shared.ts` → `dom.ts` (`kindOf`, `button`, `takeTitle`, `spokenText`,
  `numberedName`, `renderMeta`, `copyButton`), `jump.ts` (`flashTarget`, `jumpTo`, `linkJump`,
  `templateFor`), `fold.ts` (`setFolded`, `unfoldAncestors`, `applyCollapsible`), `paper.ts`
  (`formatPaper`).
- `elements/{status,collab,aid}.ts` → `src/runtime/`.
- Break the `shared.ts:7` ↔ `address.ts:17` cycle (move `rememberAddress` beside `linkJump`).
- `deck.ts` exports `getDeck()`; `shared.ts:44` and `address.ts:29` use it instead of reading
  `window.Delta`, which is the public surface for packs, not an internal bus.
- Update the helper table in `CONTRIBUTING.md:203-211` and the file map in `ARCHITECTURE.md`.
- Done when: nothing outside `elements/` imports from `elements/`; the golden check is identical.

### WP-R2 — one way to fold, one way to activate
*Why:* three fold implementations and three Enter/Space handlers drift apart.
- `fold.ts` gains `asToggle(el, flip)`: `role="button"`, `tabIndex`, click, and Enter/Space
  only when the element itself is the target. Use it in `applyCollapsible`
  (`shared.ts:240-254`), the proof step head (`proofstructure.ts:90-99`) and the math-ref
  marker (`ref.ts:163-168`).
- One motion helper for the timed refold: `aid.ts:94-122` and `foldStep`
  (`proofstructure.ts:109-130`) duplicate the timer, `REFOLD_MS` and the reduced-motion check.
- **Verify first, with a test expected to fail:** in a deck, Space on a focused control
  probably pages the slide instead of activating the control. `deck.ts:124-152` handles `" "`
  on `document`, and four elements work around it with their own `stopPropagation`
  (`comment.ts:61-62`, `change.ts:61-62`, `status.ts:191`, `proofstructure.ts:186-189`). If the
  test fails, make the deck ignore Space/Enter when the target is inside an interactive
  control and delete the four workarounds. If it passes, drop this bullet.

### WP-R3 — name the contracts between elements
*Why:* renaming a class in one element silently breaks another.
- `insidePreview(el)` for the four `.xref-pop-body` checks (`aid.ts:44`, `comment.ts:44`,
  `environment.ts:186`, `proofstructure.ts:55`).
- `labelSlot(target)` for where a mark anchors: `comment.ts:73-75` and `todo.ts:96` carry two
  different selector lists for the same idea.
- `section.ts:90-94` lists the result tags by hand; derive the list from `RESULT_TAGS`.

### WP-R4 — make CSS order irrelevant, and prove it
*Why:* risk 4. A student adding `aaa.css` or `zzz.css` can change how another component looks.
- Rule, to write in `base.css:30-49`, `CONTRIBUTING.md` and `BUILDING.md`: a class styled by
  more than one component file is a **shell** and lives in `@layer delta.shells`; a component
  file only refines shells and its own classes.
- Test `test/runtime/css-order.test.ts`: compile a kitchen-sink document, replace `CORE_CSS`
  in the HTML with the same files concatenated in **reverse** order, and compare the computed
  styles of every element in Chromium. It fails exactly where the alphabet decides.
- Make it pass by moving shared rules into shells (expected: `.who` in `collab.css`,
  `.status-pill`, the rest of `collapse.css`), then remove the bumps in `reference.css:122-137`.

### WP-R5 — accessibility quick fixes
`cite.ts:31-36`: the trigger is a `<span>` of `<a>` without `href`, so a citation cannot be
opened from the keyboard. `utils.ts:73` advertises `aria-haspopup="dialog"` but the bubble has
no role or label. `review.ts:125,152`: toggles show state by class only; add `aria-pressed`.
`hint.ts:30-33`: the emoji needs `aria-hidden`.

### WP-R6 — runtime tests students can extend
*Why:* about twelve tags have no browser test, and there are two test styles.
- `test/browser.ts`: collect uncaught page errors from an early script and make `inspect()`
  fail on any. Every existing runtime test then also asserts "no errors".
- Move the three raw-style suites at `test/hittest.test.ts:113,173,198` into
  `test/runtime/collaboration.test.ts`, in the `inspect()` + `lazy()` style.
- Smoke tests for columns, floating, frontmatter, link, list, sidenote,
  video/audio/youtube/interactive and `hyp-*`.
- Remove the `mkdtemp` directory after each run (`test/browser.ts:55`).
- `CONTRIBUTING.md:253`: add a table of element → test file.

## 6. Phase 3 — the compiler ↔ runtime contract

### WP-K1 — one definition of each island
*Why:* the payload types are written twice and mapped field by field between them.
New `src/language/islands.ts` (imports nothing, like its neighbours): the three island ids
and the payload types. `emit.ts:162-230` builds values that `satisfies` them;
`runtime/elements/toc.ts:19` and `collab.ts:39-65` import the types instead of redefining them.

### WP-K2 — a table of compiler-written attributes, kept honest by a test
New `src/language/contract.ts`: a plain list of every attribute the compiler writes for the
runtime (`num`, `data-target-num`, `data-proof-at`, …), one line each naming the writer and
the reader. Code keeps its string literals. `test/contract.test.ts` asserts that every
`data-*` literal written under `src/compiler/` is in the table and that every entry is read
somewhere under `src/runtime/` or `src/styles/`. Spell out the names built from a template at
`math.ts:167` so grep finds them. *Why a table plus a test, not constants:* students get one
page answering "what does the compiler give my element?", drift fails CI, and ≈80 call sites
stay untouched.

## 7. Phase 4 — compiler hygiene (lowest urgency; independent of each other)

- **WP-C1 — an honest pipeline table.** `Step.name` is documented as "the function it calls"
  (`pipeline.ts:101`), but 8 steps hold logic inline (`:169-175, 180-187, 192-194, 209-211,
  257-261, 307-311, 369-371, 386-389`). Move each body into a function of that name in its own
  module; keep names and order. Export the `Parsed` type (`:153`), re-spelled in six files.
  Correct `CONTRIBUTING.md:66` and `ARCHITECTURE.md:37` to describe the three real step shapes.
- **WP-C2 — one walker, named skip policies.** Convert the hand-written recursive walkers that
  only "visit every element except inside X" to `elements(doc, skip)` or `walk`
  (`ast.ts:90,106`), and name the policies once in `tags.ts`. Candidates: `collab.ts:41`,
  `linebreaks.ts:31`, `code.ts:37`, `final.ts:64`, `numbering.ts:75`, `proof-links.ts:29`.
  Leave the walkers that mutate children as they go. *Why:* which subtrees a pass skips is
  where two passes most easily disagree.
- **WP-C3 — vocabulary back in `src/language/`.** Move `STEP_PARENTS` (`structure.ts:42`,
  equal to `PROOF_TAGS`), `NOTES` (`:45`), `UNCHECKED` (`graph-hash.ts:37`), `ASSET_TAGS`
  (`include.ts:9`), `NEVER_REVEAL` (`animated.ts:20`), `AID_OWNERS` (`understanding.ts:19`) and
  the comment, todo and member vocabularies (`collab.ts:20-22`, `team.ts:24`). List the tags
  the compiler synthesizes (`step-claim`, `hyp-*`, `pm-*`). Add `stale` to the status
  vocabulary (`graph.ts:404` writes it). Leave single-tag tests like `tag === "proof"` alone.
- **WP-C4 — the same API for one file and for a project.** Same failure rule (no output when
  any file has an error), same review item shape, `final` read from one place. Extend the
  equivalence test at `test/pipeline.test.ts:113-132` to failing builds.
- **WP-C5 — diagnostics with a code.** Optional `code` on `Diagnostic` (`context.ts:9`).
  `graph-report.ts:492` filters on `d.message.startsWith("Unresolved reference")`.
- **WP-C6 — split three files along obvious seams.** `graph.ts`: the two tree-mutating passes
  (`annotateHypotheses`, `markStale`) out of the model. `graph-report.ts`: analysis
  (`frontier`, `overclaimed`, `lintFindings`) apart from formatting. `commands.ts`: the watcher
  (`:288-331`). One `lineOf(source, offset)` for the five copies (`parse.ts:47`, `graph.ts:514`,
  `graph-report.ts:150`, `verify.ts:98`, `toml.ts:264`).
- **WP-C7 — tests use the production front end.** `test/helpers.ts:40` parses with
  `parse(preprocess(src))` and so skips `parseSource`.

## 8. Verification

- Every WP: `npm run typecheck && npm test`, green, with Chromium present.
- **Golden check for refactors** (R1–R3, K1, C1–C7): before the change run `npm run docs`,
  `npm run example`, `npm run example:project`, `npm run example:collab` and copy the outputs
  aside; run them again after and `diff -r`. The HTML must be byte-identical.
- Phase 1 end to end: `node src/cli.ts build` a document that uses `<pack-example>` and one
  that does not. `grep -c "pack: delta:example"` gives 1 and 0. Open both from `file://` with
  `lang="en"`, `lang="pt-BR"` and `theme-mode="dark"`; the label follows the language and the
  console is clean. Negative checks: add `import "../../src/runtime/utils.ts"` to the example
  pack and confirm `npm run assets` fails; add a `.js` file or an `any` to it and confirm
  `npm test` fails; add a type error and confirm `npm run typecheck` fails.
- WP-S1/S2: open a PR from a throwaway branch; both workflows run; the Pages URL serves the site.

## 9. Not proposed, on purpose

Splitting core into packs; a compiler-plugin API; a UI framework or a base class for
elements; replacing the hand-written XML and TOML parsers; typed per-tag AST nodes; moving
the plot into the core runtime; requiring TypeScript of local or npm packs; a tag whitelist
that rejects unknown tags.

## 10. Suggested order

S1 → S2 → S3 → S4 → **P1 → P2 → P3 → P4** → (merge `feature/animation`) → R1 → R6 → R2 → R4 →
R3 → R5 → K1 → K2 → C1…C7. Phases 0 and 1 give students the most. After R1 the rest can be
taken in any order.

## Appendix A — the plot pack as modules

Paths relative to `examples/example-plot/packages/plot/` on `origin/feature/plot`. Each file
becomes `.ts`, needs `export` on its top-level declarations, these imports, and types. The
graph has no cycles.

| File | Imports from |
|---|---|
| `auxiliary/index.js`, `factory/index.js`, `data-handle/index.js` | nothing |
| `actions/index.js` | `auxiliary`, `data-handle` |
| `subcomponents/title/actions/index.js` | nothing |
| `subcomponents/grid/actions/index.js`, `axis/actions/index.js` | `auxiliary` |
| `subcomponents/point/actions/index.js` | `auxiliary` |
| `subcomponents/points/actions/index.js` | `auxiliary`, `data-handle` |
| `subcomponents/function/actions/index.js` | `factory`, `auxiliary` |
| `subcomponents/<s>/index.js` | its own `actions`; `point` and `function` also `data-handle` |
| `index.js` | `actions`, and every subcomponent |

Facts checked on the simulated port: no undeclared identifiers, no top-level `this`, the only
`window` read is `devicePixelRatio`; `factory/index.js:22-27` mutates `FN_OPERATORS` inside its
own file, so it is safe; `removeFunction` (`data-handle`) is unused; the documented API
(`plot.data`, the `delta:data-change` event) lives on the element and is unaffected. One
behaviour changes: an error during start-up now stops the whole pack, not one script of 17.
