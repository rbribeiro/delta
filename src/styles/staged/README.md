# Staged styles

Stylesheets for chrome that no runtime element builds yet. `scripts/build.ts` only
concatenates `src/styles/components/*.css`, so nothing here ships in a document. When
the element that uses one of these lands, move its file (or its rules) into
`components/` in the same change.

- `tweaks.css`: a floating settings panel (`<delta-tweaks>`, `.twk-*`). Its colours are
  hard-coded on purpose (a glass panel that reads over any theme); turn them into
  tokens before it ships.
- `runhead.css`: a sticky running header (`.runhead*`).
- `deck-counter.css`: a "3 / 12" slide counter pill for presentations.
