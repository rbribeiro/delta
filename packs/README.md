# Standard packs

A **standard pack** is an optional component that ships with Delta: one folder here, written in
TypeScript, bundled into the CLI, and inlined into a document **only when the document uses one
of its tags**. It is where new components usually come in: a pack keeps its own internal
structure, needs no compiler change, and costs nothing to documents that don't use it.

Delta has three tiers with one contract, `window.Delta` ([src/runtime/api.ts](../src/runtime/api.ts)):

| Tier | Where | Loaded | Written as | For |
|---|---|---|---|---|
| Core | `src/runtime/elements/` | always | TypeScript, strict | what needs compile-time data (numbering, refs, ToC) |
| Standard pack | `packs/<name>/` | when its tag is used | TypeScript, same `tsconfig.json` | optional components shipped with Delta |
| Local / npm pack | the author's folder, `node_modules` | when declared | one classic script, any source | prototypes and third parties |

The usual path: a local pack (a JavaScript prototype is fine) → a standard pack (a PR adding one
folder here) → core (rare, and by then nearly a file move, since the code standard is the same).

## Anatomy

Copy [example/](example/):

```
packs/example/
  delta.pack.json   {"tags": ["pack-example"]}: the tags it registers, bare
  index.ts          the entry: imports its modules, registers its elements
  label.ts          a sibling module (a pack may have as many as it likes)
  theme.css         styles, every selector under the root tag, colours as --delta-* tokens
  strings.json      {"en": {"example.label": "…"}, "pt": {…}}: keys prefixed with the pack's name
  README.md
```

Optional manifest fields: `js` (another `.ts` entry), `css`, `strings` (other file names). A
standard pack has no `needs`: it imports modules instead.

## How it is built and loaded

- `npm run assets` ([scripts/build.ts](../scripts/build.ts) `bundlePack`) bundles each pack into
  one minified script and writes `BUILTIN_PACKS` into `src/generated/assets.ts`. It fails when
  the entry is not `.ts`, or when the bundle pulls in a file outside the pack's folder: reach
  core through `window.Delta`, never by importing `src/` (a type-only import is fine).
- `npm run typecheck` checks packs with core's `tsconfig.json`: strict, `.ts` extensions in
  imports, no `enum`/`namespace`.
- When emit writes a document, it records every tag it serializes and inlines the packs that
  own one, after the author's own packs. An author's pack that registers the same tag wins.
  See "On-demand granularity" in [docs/PACKAGES.md](../docs/PACKAGES.md).

## The developer loop

```
npm run dev -- build demo.dlt -o demo.html   # rebuilds the packs every time (predev runs assets)
npm test                                     # includes test/packs.test.ts and test/packs/
```

`delta build --watch` does **not** see edits to a pack: the CLI loads the bundled packs once, at
start. Rerun the command after editing a pack.

## Admission checklist

A PR adding or changing a pack here is ready when all of these hold. `test/packs.test.ts` checks
the ones marked ✓ for every pack automatically.

1. One folder, one `delta.pack.json`. **TypeScript only** (✓ no `.js`/`.mjs`/`.cjs`), passing
   `npm run typecheck`, with no `any` and no `@ts-ignore` (✓). Internal files use
   `import`/`export`. No `needs` (✓), no sub-manifests, nothing left on `window`.
2. It registers **exactly** the tags in `tags` (✓), normally one root element, and none that
   core registers or styles (✓) or another pack claims (✓). Children are plain unregistered
   elements the root reads (`:scope > delta-point`), as core does for `<column>`
   ([columns.ts](../src/runtime/elements/columns.ts)). Never register a generic name (`point`,
   `option`, `title`, `date`, `link`): a document that already uses that tag would start loading
   the pack.
3. The entry registers its elements explicitly and in order, like `defineComponents()` in
   [src/runtime/elements/index.ts](../src/runtime/elements/index.ts).
4. No expando that shadows a DOM property (`title`, `hidden`, `id`, `style`); keep the
   element's state in typed class fields or one typed object.
5. Every visible string goes through `window.Delta.t("<pack>.key", fallback)`, with the keys in
   `strings.json`: the same keys in every language, each prefixed with the pack's name (✓).
6. CSS: selectors scoped under the root tag, existing `--delta-*` tokens only (✓ no literal
   colour), correct with `theme-mode="dark"`.
7. Keyboard reachable, a visible focus ring, accessible names on canvases and icon buttons.
8. No `fetch`, no URL, no `eval` (✓ for the bundle's external references). `new Function` over a
   whitelisted grammar is tolerated, with unit tests for hostile input.
9. One browser test in [test/packs/](../test/packs/) (copy `example.test.ts`), unit tests for
   pure logic, and one demo on the site.
10. No compiled HTML in the PR.
