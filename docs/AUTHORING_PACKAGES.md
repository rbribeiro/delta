# Authoring Delta packages

A practical guide for developers and agents building Delta **packages** — the one extension
unit that adds new `<tag>`s to the language. For the *system* design (resolution channels,
dedup, the "why", tag-gating rationale) read [PACKAGES.md](PACKAGES.md); this document is the
**how-to** and the **style contract**.

> TL;DR — A package is a **classic browser script** that `customElements.define("delta-<tag>", …)`
> plus an optional stylesheet that styles `delta-<tag>` **using the `--delta-*` design tokens**.
> Both get **inlined** into every output that uses the tag, alongside the core runtime and every
> other pack. So: keep it small, minify it, reference nothing external, reuse the design system
> instead of restating it, and split unrelated features into separate packages.

---

## 1. When to build a package (and how to scope it)

Build a package when you want a **new author-facing element** whose behavior is chrome the browser
renders (a widget, a layout, a viewer) — not something that needs a compiler pass. Packages are
**runtime-only**: they cannot read the filesystem, add numbering, register a `<ref>` kind, or
resolve anything at compile time. Anything that needs a pass stays first-party (see
[PACKAGES.md](PACKAGES.md) → "Runtime-only, by design").

**Scope one package to one coherent feature.** Because every declared package that a document uses
is inlined into that document, a grab-bag package makes *every* page that wants one element pay for
all of them. Rules of thumb:

- **Split by nature.** A `<quiz>` interaction, a `<map>` viewer, and a `<citation-graph>` are three
  unrelated concerns → three packages. A reader installs (and inlines) only what a given document
  uses.
- **Group by cohesion.** Tags that share code, styling, and always ship together (e.g. `<tabs>` +
  `<tab>`) belong in one package.
- **Prefer many small packages over one large one.** With tag-gating (roadmap item 48) a document
  inlines a package only when one of its `tags` actually appears — small, single-purpose packages
  are what make that gating pay off.

---

## 2. Anatomy of a package

A package is **an npm package or a local folder** with, by convention:

```
my-pack/
  package.json        # optional: a "delta" field is the manifest
  index.js            # the browser script (default entry)
  theme.css           # the component stylesheet (default, optional)
```

The minimum is a single `index.js`. See the worked example in
[../examples/imports/mod/](../examples/imports/mod/) (`<callout>`).

### Manifest (optional)

Declare a manifest as a `"delta"` field in `package.json`, or a `delta.pack.json` beside the entry.
Every field is optional; an absent manifest means the `index.js` + `theme.css` convention.

```jsonc
{
  "delta": {
    "js":  "dist/pack.min.js",   // entry script, relative to the pack dir (default "index.js")
    "css": "dist/pack.min.css",  // stylesheet, relative to the pack dir (default "theme.css")
    "tags": ["callout", "marginfig"],  // the delta-* tags this pack owns (bare, no "delta-" prefix)
    "needs": ["delta-baseui"],   // other packages this one pulls in (resolved dependency-first)
    "deltaVersion": ">=0.2"      // compatible Delta range (parsed, not yet enforced)
  }
}
```

- **`tags`** — list the author-facing tag names you register, **bare** (`"callout"`, not
  `"delta-callout"`). Declaring them is good documentation today and the hook for **tag-gating**
  (roadmap 48): a document that never uses one of your tags won't inline your JS/CSS at all. Declare
  them accurately.
- **`needs`** — depend on another package; the resolver inlines dependencies first so your code can
  build on theirs. A dependency library that exposes no author tags should declare no `tags` (it is
  always inlined for anyone who needs it).

### How it gets inlined (know your neighbors)

The emitter inlines, in order: core CSS → per-type theme → KaTeX CSS (if math) → **your pack CSS** →
the author's `<document theme>` CSS; then, at the end of `<body>`: the core runtime → **your pack
JS** → the next pack's JS. Two consequences you must design around:

1. Your **JS runs after the core runtime**, so `window.Delta` is available (see §4).
2. Your **CSS is overridable by the author's theme** (it's inlined before it) and lives in the
   **global** document — there is no shadow DOM. Scope every selector to your tag (§5).

---

## 3. Writing the custom element (JS conventions)

The compiler renames every author `<foo>` to `<delta-foo>` in the output, so your script registers
the **prefixed** tag. Follow the house pattern (from [../src/runtime/elements/](../src/runtime/elements/)):

```js
// classic browser script — NO import/export, NO bundler-only syntax
customElements.define(
  "delta-callout",
  class extends HTMLElement {
    connectedCallback() {
      // connectedCallback can fire again when the node is moved — guard it.
      if (this.dataset.deltaReady) return;
      this.dataset.deltaReady = "1";

      const label = document.createElement("div");
      label.className = "callout-label";                  // style via your theme.css, scoped
      label.textContent = this.getAttribute("label") || Delta.t("callout", "Note");
      this.prepend(label);
    }
  },
);
```

Conventions, all load-bearing:

- **Classic script, not a module.** The entry is inlined into a `<script>` (no `type="module"`).
  Do **not** use `import`/`export`; bundle to a single classic IIFE/script if you use tooling
  (esbuild `--format=iife`, Rollup `format: "iife"`). `import(...)` and top-level `export` are
  flagged as external references (see §6).
- **Register `delta-<tag>`.** The author writes `<foo>`; you define `delta-foo`.
- **Idempotent `connectedCallback`.** Guard with `this.dataset.deltaReady`; the callback can fire
  more than once (moves, re-parenting by other elements like the deck).
- **The runtime already ran.** Children are fully parsed before your `connectedCallback` (the
  runtime is at the end of `<body>`); read `this.children` / `querySelector(":scope > …")` freely.
- **Read config from attributes**, matching Delta's "resolve data at compile time, render chrome at
  runtime" split — the author's `<foo label="…">` is your input.
- **Don't collide.** Namespace inner class names (`callout-label`, not `label`) and any global you
  add. One package, one clear surface.

### The `window.Delta` API (the stable pack surface)

Build against `window.Delta` — the only contract packages may rely on:

| Member | Signature | Use |
|---|---|---|
| `Delta.popover` | `popover(trigger, content)` | The shared top-layer bubble controller (hovercards, reveal-on-click). Handles positioning, one-open-at-a-time, Esc/outside-click. Style the bubble with the `.delta-pop` class. |
| `Delta.t` | `t(key, fallback?)` | Localized UI string for the document's `lang`, read from the `#delta-i18n` island. Always pass a `fallback`; never hardcode user-visible English. |
| `Delta.deck` | `Deck \| null` | The presentation deck handle when `type="presentation"`, else `null`. `{ index, total, go, next, prev, onChange, goToId }` — hook `onChange` to react to slide changes. |

Anything outside this table (internal helpers, private classes) is **not** a contract and may change.

---

## 4. Styling with the design system (CSS conventions)

**Do not restate the design — inherit it.** Every color, size, radius, shadow, and easing your
component needs already exists as a `--delta-*` custom property on `:root` in
[../src/styles/base.css](../src/styles/base.css). Using those tokens is what makes your element look
native **and** get **accent recoloring and dark mode for free**: the `[data-accent="…"]` palettes
(12 hues) re-set the accent tokens and `[data-mode="dark"]` re-sets the neutral ramp — a component
built on tokens follows both with zero extra CSS.

```css
/* theme.css — scope EVERY selector to your tag (no shadow DOM; you share the page). */
delta-callout {
  display: block;
  margin: var(--delta-block-gap) 0;
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--delta-accent-ink);
  border-radius: var(--delta-radius);
  background: var(--delta-accent-soft);         /* not a hardcoded tint */
  color: var(--delta-ink);
  font-family: var(--delta-sans);
  box-shadow: var(--delta-shadow-sm);
}
delta-callout .callout-label {
  font-weight: 600;
  color: var(--delta-accent-ink);
  letter-spacing: var(--delta-tracking-cap);
}
```

### Token reference (use these, don't invent hex)

| Group | Tokens |
|---|---|
| **Surfaces** | `--delta-paper`, `--delta-paper-edge`, `--delta-surface-1`, `--delta-surface-2` |
| **Ink / text** | `--delta-ink`, `--delta-ink-soft`, `--delta-mute` |
| **Rules / borders** | `--delta-rule`, `--delta-rule-soft`, `--delta-hairline` |
| **Accent** | `--delta-accent`, `--delta-accent-ink`, `--delta-accent-soft` (recolored by `[data-accent]`) |
| **Status** | `--delta-ok`, `--delta-warn` |
| **Chrome** | `--delta-env-bg`, `--delta-env-border` (theorem-box look; reuse for boxed chrome) |
| **Code** | `--delta-code-bg`, `--delta-code-fg`, `--delta-code-line`, `--delta-code-mute` |
| **Type families** | `--delta-serif`, `--delta-sans`, `--delta-mono` |
| **Type scale / rhythm** | `--delta-t-base`, `--delta-t-small`, `--delta-t-deck`, `--delta-math-scale`, `--delta-leading`, `--delta-leading-tight`, `--delta-tracking-cap` |
| **Layout** | `--delta-measure`, `--delta-margin-w`, `--delta-col-gap`, `--delta-block-gap`, `--delta-section-gap`, `--delta-page-pad-x/-y` |
| **Shape** | `--delta-radius-sm`, `--delta-radius`, `--delta-radius-lg`, `--delta-radius-pill` |
| **Shadow** | `--delta-shadow-sm`, `--delta-shadow`, `--delta-shadow-lift`, `--delta-shadow-code` |
| **Motion** | `--delta-ease`, `--delta-dur-fast`, `--delta-dur`, `--delta-dur-slow` |

Full, authoritative list: the `:root` block in [../src/styles/base.css](../src/styles/base.css).

### Reuse the shared primitives

Before styling from scratch, reuse the base classes (defined in `base.css`, available globally):
`.btn` (`.primary` / `.ghost`), `.widget` (with `.widget-head` / `.widget-body` / `.widget-foot`),
`.input`, `.range`, `.field-label`, `.kbd`, `.eyebrow`, `.code`, `.delta-pop` (popover bubble). If
your element is an interactive card, wrap it in `.widget`; if it has a control, use `.btn` / `.input`
— you inherit the whole look and every theme override.

### CSS rules

- **Scope to your tag.** `delta-callout { … }`, `delta-callout .part { … }`. Never style bare
  elements or generic classes — you'd leak into the whole document.
- **Prefer tokens + `color-mix(in oklab, …)`** over literals, so accent/dark keep working.
- **Respect `prefers-reduced-motion`** for any transition, using the motion tokens.
- **Mobile:** the base grid stacks at ≤640px; test that your element reflows.

---

## 5. Size, minification, and the offline invariant

Every package you declare is **inlined verbatim** into each output that uses it — shipped in the
same file as the core runtime + CSS blob, KaTeX when present, and every other pack. Bytes are not
amortized across a CDN; they live in the document. So:

- **Keep it lean.** No framework, no large dependency for a small widget. Vanilla DOM is the norm
  here (see any file under [../src/runtime/elements/](../src/runtime/elements/)).
- **Minify what you ship.** Point the manifest `js`/`css` at **minified** build outputs
  (`dist/pack.min.js`, `dist/pack.min.css`). Delta inlines the file as-is — it does not minify for
  you. A source-readable `index.js` is fine for a tiny pack; anything non-trivial should ship
  minified.
- **Split unrelated features** into separate packages (see §1) so a document only inlines what it
  uses — the single biggest lever on output size.
- **Reference nothing external.** The whole point of Delta output is that it runs offline from
  `file://`. Your inlined code must contain **no** `fetch(`, no dynamic `import(`, no `http(s)://`
  URLs (JS), and your CSS **no** `@import` and no remote `url(...)`. These are flagged as warnings at
  compile time ("references an external resource; output may not work offline"). Inline assets as
  `data:` URIs if you truly need them, and keep them small.

---

## 6. Checklist

- [ ] One coherent feature per package; unrelated tags → separate packages.
- [ ] `index.js` is a **classic script** (no `import`/`export`); it `customElements.define("delta-<tag>", …)`.
- [ ] `connectedCallback` is guarded with `this.dataset.deltaReady`.
- [ ] UI strings go through `Delta.t(key, fallback)`; pop-overs use `Delta.popover`.
- [ ] `theme.css` scopes **every** selector to `delta-<tag>` and styles only via `--delta-*` tokens
      and the shared primitives — no hardcoded colors/sizes.
- [ ] Manifest declares accurate `tags` (bare names) and any `needs`.
- [ ] Shipped `js`/`css` are **minified**; nothing references an external resource.
- [ ] Verified: compile a doc using the tag and confirm the output has no `http(s)`/`<link>`/`@import`
      and the element renders + recolors with `theme-accent` and `theme-mode="dark"`.

## See also

- [PACKAGES.md](PACKAGES.md) — the package **system** (resolution channels, dedup, tag-gating design).
- [../examples/imports/mod/](../examples/imports/mod/) — a minimal working `<callout>` package.
- [../src/runtime/elements/](../src/runtime/elements/) — first-party elements to copy conventions from.
- [../src/styles/base.css](../src/styles/base.css) — the authoritative `--delta-*` token list and shared primitives.
