# Delta roadmap

The feature set comes from `DELTA_INFO.md`. Items are ordered so each milestone is
usable on its own. Checked items are implemented and tested.

## M1 — Core authoring loop (v0.1)

- [x] 1. Preprocessor: `<`, `>`, `&` allowed inside `$…$`, `$$…$$` and raw tags; `\$` literal
- [x] 2. Strict XML parse → generic AST with source positions and diagnostics
- [x] 3. Data-driven numbering (`environments.ts`): theorem family shares a counter,
       section prefixes (`1.2`), counters reset, explicit `num` override
- [x] 4. Compile-time KaTeX: `<m>`, `<equation>`, `$…$` / `$$…$$` in prose
- [x] 5. Emitter: every tag → `<delta-tag>`, single-file HTML, KaTeX CSS with `data:`
       fonts, runtime IIFE inlined, **"no external resources" test**
- [x] 6. `<ref to="…">`: `references.ts` resolves against the registry (writes `num`+`kind`), emit
       snapshots each referenced target into `<template data-delta-pop="id">`; `delta-ref` composes the
       localized link ("Theorem 1.1") and clicks open a `.delta-pop` preview cloned from the template
       (no `fetch`), with a jump-to button. Unresolved/`to`-less refs warn and render as inert text
- [x] 7. Table of contents: `<toc/>` → `toc.ts` builds the heading tree (auto-slugging ids for headings
       without one), emit ships it as the `#delta-toc` island, `<delta-toc>` renders a nested nav that
       smooth-scrolls + flashes the target; `depth` (default subsections) limits it at runtime
- [x] 8. Collapsible behavior: `collapsible="true"` / `collapsed="true"` on sections and
       environments — the label (heading / box tag / proof lead) toggles a `.collapse-body`
       (`applyCollapsible` in `elements/shared.ts`, styled by `components/collapse.css`)
- [x] 9. `<solution of="…">` linking to its exercise
- [x] 10. `<meta>` / `<meta-item>` / `<author>` rendered in environment headers
- [x] 11. Default theme: full design system (`base.css`), documented `--delta-*` tokens,
       page+sidenote layout, JS-off fallback; shared primitives (`.btn`, `.widget`, `.code`, …)

> Component **styling** for the standard library is now in `src/styles/components/*.css`
> (`@layer delta.components`); items marked _(CSS staged)_ have their CSS in place and need only the
> runtime element built. Note: `<youtube>` is an intentional **online-only** exception to the offline
> invariant — its iframe loads from youtube.com at view time, and the author's URL rides through in the
> `src` attribute.

## M2 — Media & prose furniture

- [x] 12. `<figure src="…">`: local image inlined as a `data:` URI at compile time (`figures.ts`),
       numbered "Figure N" caption; missing/remote/unsupported srcs warn and render a missing note
- [x] 13. `<video>` / `<audio>` (relative `src`, captions) and `<youtube>` embed. `<video>`/`<audio>`
       take a **relative** `src` (ship the media file beside the HTML); `<youtube>` is the online-only
       exception. `<video>`+`<youtube>` share a counter; `<audio>` has its own.
- [x] 14. `<sidenote>` responsive margin notes
- [x] 15. `<hint>` pop-over — inline `.hint-trigger` reveals the body in a `.delta-pop`
       bubble via the shared `Delta.popover` controller (`runtime/utils.ts`)
- [x] 16. `<equation(s)>` aligned multi-line environment (shipped early with the math pass)
- [x] 31. `<floating>` navigation button (runtime-only, "Shape 3"): a corner button that expands
       a panel via the shared `Delta.popover` controller (`runtime/utils.ts`), holding the author's
       children — typically a `<toc>` (plain or `scope="project"`) so readers navigate from anywhere
       without scrolling back. A `<title>` child labels the button + panel header (falls back to the
       localized "Contents"). No compiler changes — `buildToc` already finds the nested `<toc>` via the
       recursive `elements()` walk. `DeltaFloating` (`runtime/elements/floating.ts`), styled by
       `components/floating.css`

## M3 — Bibliography

- [x] 17. `.ref` file loading (`bibliography.ts`): `<bibliography src="x.ref">` reads + parses a strict-XML
       `.ref` (rooted in `<bibliography>`, wrapping `<paper id>` entries) relative to the doc, like the
       theme/import passes; inline `<paper>` children are also accepted. The whole database is loaded into
       `ctx.papers` — never spliced into the body; a missing/remote src or id-less/duplicate paper warns
- [x] 18. `<cite paper="…">` / `<cite papers="a,b">`: `resolveCitations` numbers papers by first appearance
       (one number per distinct paper, document-wide), writes parallel `data-cite-nums`/`data-cite-ids`,
       and records each cited id in `ctx.referencedIds` so emit snapshots it into a `<template>` (offline
       pop-over, like `<ref>`). `DeltaCite` renders "[1, 2]" (each number jumps to its entry) with a
       `.cite-pop` hovercard; unknown ids warn, an all-unknown cite stays inert
- [x] 19. Bibliography generated from cited papers only: `resolveCitations` fills `<bibliography>` with the
       cited `<paper>` nodes in citation order; `DeltaBibliography` lifts them into a numbered `.notes`
       list (localized "References" heading). Uncited entries never ship

## M4 — Multi-file & projects

- [x] 20. `<include src="…">` merge (`include.ts`): strips the inner `<document>`, splices children
       before numbering, recursive with cycle detection; relative asset paths rewritten master-relative;
       missing/cyclic/non-local src is a build error
- [x] 21. Multi-file compilation = one project (`project.ts`): `compileProject` runs the same passes
       across many inputs but threads shared state — one counter `NumberingState` continues numbering
       file-to-file, and the `registry`/`papers`/`citedPapers` are shared, so a `<ref>`/`<cite>` in any
       file resolves into any other. Emit is deferred until every file's math is rendered, then each
       output snapshots its referenced targets (refs **and** cited papers) from a project-wide
       `globalById` — a copy ships into each output, so pop-overs work with no `fetch`. Cross-file jumps
       carry `data-target-href`/`data-cite-file` and navigate to the target's own output (flashing on
       arrival); same-file links keep the in-page scroll. Citations number project-wide; the first
       `<bibliography>` (in input order) renders the references list for the whole project.
       `<toc scope="project">` lists the whole book: `buildProjectToc` (`toc.ts`) slugs every file's
       headings into one ordered list tagged with each section's home output, and the runtime navigates
       cross-file (a plain `<toc/>` still lists only its own file — both can coexist in one file)
- [x] 22. `project.toml` (`config.ts`): `inputs` (ordered, required) + `out` (output dir, default `.`),
       resolved relative to the toml; parsed with `smol-toml`. The CLI takes a `.toml` (or `--project`),
       several `.dlt` inputs (a project with `-o` as the out dir), or one `.dlt` (single-file, unchanged).
       Outputs are flat `<basename>.html`; colliding basenames are an error
- [ ] 23. `--per-chapter` / `--per-section` output splitting (CLI flag or project.toml)

## M5 — Theming & extensibility

- [x] 24. `theme="my.css"` on `<document>`: author CSS resolved relative to the doc (`theme.ts`),
       inlined **last and unlayered** by emit so it overrides core + the type theme; remote/missing =
       warning, an `@import`/remote `url()` warns but is still inlined
- [x] 25. Documented theme variable naming convention (`--delta-*` tokens, `@layer` cascade)
- [x] 26. `<import src="folder/">` custom-element packs (`imports.ts`): reads a pack folder's
       `index.js` + optional `theme.css` (relative to the doc) and inlines both — the JS in a `<script>`
       **after** the runtime (so `window.Delta` is available; the pack registers its own `delta-*`
       elements), the CSS in a `<style>` **before** the author theme. Imports are direct children of
       `<document>` and are stripped from the tree; a missing/remote pack is a warning, an external
       reference inside a pack file warns but is still inlined, and the same pack imported twice inlines once
- [~] 27. Document-type CSS variants via `<document type>` (`@layer delta.theme`): `article`
       (default) and `book` shipped; the `presentation` type is specified in M7–M8

## M6 — Polish

- [~] 28. `lang` attribute + i18n strings: `strings.ts` table (en + pt), `#delta-i18n` data-island,
       runtime `t()`; environment labels localized. Figure/video/audio/table/contents keys seeded,
       applied when those elements land
- [ ] 29. Diagnostics polish: warnings for unresolved refs/cites, unclosed math regions
- [ ] 30. Author documentation (`docs/authoring.md`) and richer examples
- [x] 31. Code component with highlight syntax

## M7 — Presentations (core deck)

The `presentation` document type (`<document type="presentation">`) turns a `.dlt` into a
self-contained, offline slide deck. Like `collapsible`/`<floating>`, nearly all deck behavior
is **runtime-only** — the compiler stays generic. Activation: `emit` writes `data-type` on
`<html>` (beside the existing `data-accent`) so both the CSS (`:root[data-type="presentation"]`)
and the runtime deck controller gate on it cleanly. This milestone is usable on its own; the
reveal/animation system follows in M8.

- [x] 32. `presentation` theme + deck activation: `src/styles/themes/presentation.css`
       (auto-discovered by `themeCss()` in `scripts/build.ts`, selected by `<document
       type="presentation">`) sets the deck tokens (large type, slide aspect ratio, full-viewport
       sizing, transition vars). The deck **chrome** — full-viewport slides, hide-inactive, escape
       from the article page grid — lives in a class-styled `src/styles/components/slide.css` gated
       by `:root[data-type="presentation"]` / the presence of `<delta-slide>`, the same way
       `floating.css`/`collapse.css` only matter when their elements exist. `emit.ts` adds the
       `data-type` attribute to `<html>`
- [x] 33. `<slide>` element + slide titles: runtime-only `DeltaSlide`
       (`src/runtime/elements/slide.ts`, registered in `elements/index.ts`). A `<title>` child is
       hoisted into an `<h2 class="slide-title">` at the top of the slide (**reusing the
       `<delta-title>`→heading pattern** from `section.ts`) and the rest is wrapped in a centered
       `.slide-body`. No compiler pass — slide position is chrome, indexed at runtime. _Shipped
       together with item 36 (a slide element is only testable with paging)._
- [x] 34. Section → divider slide: in presentation mode `DeltaSection` (`section.ts`) moves its
       `<title>` into a centered divider `<delta-slide divider="true">` it prepends to the section
       (no inline heading); the section box becomes `display: contents` so that divider and the
       section's own child `<slide>`s flow as ordinary deck slides. Runtime + CSS only — sections
       still compile/number/ToC unchanged; the deck collects the divider in document order (no
       controller change). Applies to all sectioning tags
- [x] 35. Progress bar: **opt-in** via a `<progress/>` marker (a direct child of `<document>`,
       like `<toc/>`; it renders nothing itself). It turns on the line that separates each slide's
       title from its body, which doubles as the progress indicator: the controller sets one global
       `--deck-progress` (= `(index+1)/total`) on the root and each slide's `.slide-rule-fill` reads
       it via `width: calc(var(--deck-progress) * 100%)`. Styled in `components/slide.css`
- [x] 36. Keyboard navigation + transitions: the deck controller (`setupDeck` in
       `src/runtime/deck.ts`, a singleton wired in `runtime/index.ts` beside `flashHash`) pages the
       slides — a global `keydown` listener (←/→, ↑/↓, plus PageUp/Down, Space, Home/End) shows one
       slide at a time (`.is-active`, hide-inactive gated on `.deck-js` so JS-off shows all), with a
       fade-in enter transition honoring `prefers-reduced-motion`. Exposes `window.Delta.deck`
       (`index`/`total`/`go`/`next`/`prev`/`onChange`/`goToId`) for add-ons (item 35 hooks `onChange`;
       a `<toc>` link in a deck pages via `goToId`)
- [x] 40. Cover / title slide: a `<cover>` element (direct child of `<document>`) with `<title>`,
       `<subtitle>`, `<author>`, `<affiliation>`, `<event>`, `<date>` fields. A presentation-only
       compiler pass (`cover.ts`) desugars it to `<slide cover="true">` so the deck pages it as the
       front slide and the existing `DeltaSlide` chrome applies; `components/slide.css` lays the
       fields out centered (styled by tag). No runtime element. Multiple authors/affiliations stack
- [x] 41. Overlay touch controls: a deck is navigable without a keyboard. `setupDeck` injects a
       subtle, always-present prev / counter / next cluster (bottom-centre, brighter on hover/touch;
       `components/slide.css`) wired to the fragment-aware `next`/`prev`; the counter tracks position
       via the `onChange` listener. Plus left/right swipe (passive touch listeners, horizontal-
       dominant). Runtime + CSS only; aria-labels localized (`prevSlide`/`nextSlide`). Jump-to-slide
       stays the existing `<floating><toc/></floating>` (its links page via `goToId`)
- [x] 42. Theme polish + running header: `themes/presentation.css` adds **deck color tokens** (all
       derived from the accent vars, so `theme-accent` recolors the whole deck) and `components/slide.css`
       gives each slide type a distinct tone — a pale accent **wash** on the cover (+ an accent rule under
       its title), an **inverted** (dark accent-ink / paper text) section divider that reads like a chapter
       page, and a short accent **kicker** rule under content-slide titles. `setupDeck` also builds a subtle
       **running header** ("AUTHOR · AFFILIATION", reusing the `.eyebrow` primitive) from the `<cover>`
       metadata already in the DOM (the talk title is left out — it can be long and clutter the header),
       pinned to the top edge and faded out on the cover and dividers. CSS + runtime only; emitted HTML
       unchanged

## M8 — Slide animation

Progressive reveal ("fragments") so a slide discloses its content step by step instead of
showing everything at once — better presentation flow. Both items share one stepping mechanism in
the deck controller: → advances to the next fragment within the current slide, and only once all
fragments are shown does it move to the next slide (the reveal.js model).

- [x] 37. Progressive reveal (`reveal` attribute): authors mark any element with `reveal="true"`
       plus optional `reveal-order="n"`. The compiler passes both through untouched (no pass — the
       `collapsible="true"` model). The deck controller (`deck.ts`) builds a per-slide ordered list
       of `[reveal="true"]` elements (sorted by `reveal-order`, DOM order as tiebreak), and steps
       through them with `.is-revealed` before advancing the slide; `←` peels them back, then enters
       the prior slide fully revealed (reveal.js model). Hidden-state CSS (`opacity`/`visibility`,
       gated on `.deck-js`) lives in `components/slide.css`; `<list>` forwards `reveal`/`reveal-order`
       onto its `<li>` so bullets can be fragments
- [ ] 38. Equation-part reveal (KaTeX `\reveal` macro): reveal pieces of a single equation in any
       order. `math.ts` enables KaTeX `trust` and passes a `macros` map — `\reveal{…}` →
       `\htmlClass{delta-reveal}{…}`, `\revealAt{n}{…}` → adds `\htmlData{reveal-order=n}` — so
       tagged sub-spans render inside the one equation. The deck reveals `.delta-reveal` spans with
       the **same** stepping logic as item 37, unifying both animation features. (Trade-off:
       `trust` + the `\html*` extension let LaTeX emit classes/attributes — acceptable since the
       author owns their own source.)
- [x] 39. `animated="true"` shorthand: a tiny compiler pass (`animated.ts`, run after
       `resolveIncludes` in both entry points) adds `reveal="true"` to every child **element** of an
       `animated` carrier — so `<slide animated="true">` reveals its blocks for free, `<list
       animated="true">` reveals its items (via the `<li>` forwarding from item 37), and nesting just
       repeats it. Skips `<title>`/`<slide>` and respects an explicit `reveal` (so `reveal="false"`
       opts a child out). Presentation-only (no-op otherwise); emits the same `reveal` data item 37
       consumes, so **no runtime/CSS change**
