# `<pack-example>`

The smallest standard pack, and the one to copy when you start a new pack.

```xml
<pack-example>Any content, <b>math</b> included.</pack-example>
```

The content is shown in a card under a small label: "Example pack", or "Pacote de exemplo" in a
`lang="pt-BR"` document.

What each file shows:

- `delta.pack.json`: the one tag the pack registers.
- `index.ts`: the root element, built once in `connectedCallback` and guarded by
  `dataset.deltaReady`, and registered explicitly.
- `label.ts`: a sibling module, imported by `index.ts`. The build bundles both into one script.
- `theme.css`: scoped under `delta-pack-example`, coloured only through `--delta-*` tokens, so
  it follows the accent and dark mode.
- `strings.json`: the label in each language, its key prefixed `example.`.

Its tests are [test/packs/example.test.ts](../../test/packs/example.test.ts) (in a browser) and
the invariants in [test/packs.test.ts](../../test/packs.test.ts). The rules are in
[packs/README.md](../README.md).
