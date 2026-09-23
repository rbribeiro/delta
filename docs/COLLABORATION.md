# Collaboration in Delta — comments, tasks, tracked changes, status, review

> **Status:** implemented (ROADMAP M9). User-facing docs, in Portuguese: `site/colaboracao.dlt`
> → `docs/colaboracao.html`. This file is the English specification for contributors and
> for AI agents that write `.dlt` files.

Delta treats a paper written by several hands — humans, agents, or both — as one `.dlt`
that carries its own review. The guiding principle:

> **The `.dlt` source is the collaboration medium; the compiled HTML is the review surface.**

Everyone (and every agent) reads and writes the source; git carries the history. The
HTML renders the collaboration state as rich, navigable, offline chrome — no persistence,
no server, no `fetch`. A `--final` build strips every mark so the *same* source publishes
the clean paper. Vocabularies are small, fixed, lowercase and attribute-based, so an agent
writes them reliably and `grep` finds them; `delta review` prints the state as text or
JSON, so an agent needs no browser.

## The vocabulary

```xml
<document lang="en">
  <team>
    <member id="rodrigo" name="Rodrigo Ribeiro" kind="human" color="blue"/>
    <member id="claude"  name="Claude"          kind="agent" color="purple"/>
  </team>
  <floating><title>Review</title><review scope="project"/></floating>

  <lemma id="lem-bound" status="review" by="claude">…</lemma>
  <proof of="lem-bound" status="sketch" by="claude">
    Hence $f$ is bounded on $K$.<comment id="c-bounded" by="claude" status="open" date="2026-09-12">
      This needs $K$ compact; <ref to="lem-compact"/> only gives closed.
      <reply by="rodrigo" date="2026-09-13">Good catch: add the hypothesis.</reply>
    </comment>
    So <change by="claude" date="2026-09-12" note="sign was reversed"><old>$x < 0$</old><new>$x > 0$</new></change>.
  </proof>
  <todo id="t-compact" for="claude" by="rodrigo" status="open" priority="high">
    Finish the proof of <ref to="lem-bound"/> in the non-compact case.
  </todo>
  <draft by="claude" note="argument still loose">…prose…</draft>
</document>
```

| Tag / attribute | Values | Notes |
|---|---|---|
| `<team>` › `<member id name kind color>` | `kind` = `human` (default) \| `agent`; `color` = a base.css palette name (`red orange yellow lime green teal sky blue indigo purple pink slate`), round-robin when omitted | a direct child of `<document>`; removed from the output (the data ships in the island). With a team, an unknown `by`/`for`/`verified-by` warns; without one, `by` is free text |
| `<comment by status date on id>` › `<reply by date>` | `status` = `open` (default) \| `resolved` | inline or block. `on="id"` anchors the marker to another element (its box tag / heading / proof lead) |
| `<todo for by status priority due on id>` | `status` = `open` \| `doing` \| `done`; `priority` = `high` \| `normal` \| `low` | a block checklist row; `on="id"` places it right after the target |
| `<change by date note id>` › `<old>` / `<new>` | `kind` inferred and written: `<old>`+`<new>` → `replace`, `<old>` only → `delete`, `<new>` only or bare content → `insert`; `block="true"` inferred when it wraps block content | inline or around whole blocks |
| `status` / `by` / `verified-by` on any block | `status` = `draft` \| `sketch` \| `review` \| `verified` | environments, proofs, sections, `<draft>`. `by` = who wrote the block, `verified-by` = who checked it |
| `<draft by note>` | `status` defaults to `draft` | wrapper for loose prose with no header |
| `<review scope>` | `scope="project"` lists every file of a project | the panel; works inside `<floating>` |

Inside `$…$` write a bare `<` (the preprocessor escapes it); `&lt;` inside math breaks KaTeX.

### Numbering

`comment`, `todo` and `change` each have their own counter with **no section prefix and no
reset**: C1…Cn across the document (or the whole project). So `<ref to="c-bounded"/>`
renders "Comment 3" (pt: "Anotação 3") and the target snapshots into a `<ref>` preview
like any other numbered element. **Descendants of `<comment>`, `<todo>` and `<old>` are
neither numbered nor registered** (`OPAQUE` in `numbering.ts`): an equation quoted in a
comment must not shift the paper's numbering between the review build and the final one.

### Labels

The pt label for `<comment>` is **"Anotação"**, not "Comentário": `<remark>` already owns
"Comentário", and a `<ref>` label is `t(tag) + " " + num`, so two tags with one label would
make "Comentário 3" ambiguous. `todo` → "Tarefa", `change` → "Alteração", statuses →
"Rascunho / Esboço / Em revisão / Verificado", the panel → "Revisão".

## What the compiler does

Pipeline (both `compileSource` and `compileProject`): `… → resolveIncludes → finalizeReview
→ collectTeam → resolveCollab → … → numberDocument → … → buildToc → buildReview → … → emit`.

- `team.ts` `collectTeam`: `<team>` → `ctx.team` (shared across a project), node removed.
- `collab.ts` `resolveCollab`: writes the defaults the runtime and `--final` key off
  (`status="open"`, `priority="normal"`, `kind="replace"`, `block="true"`, `<draft
  status="draft">`), warns on anything outside the vocabularies, checks people against the
  team. Exports `changeParts` (shared with `final.ts`).
- `environments.ts`: the three counters. `numbering.ts`: `OPAQUE`.
- `review.ts` `buildReview` / `buildProjectReview`: collects every item into `ctx.review`
  with its number, people, a plain-text rendering (`text`: math back from KaTeX's TeX
  annotation as `$…$`, refs as "Lemma 2.1"), its live body nodes, and the nearest
  enclosing heading (slugging an id onto that heading if it has none — only those). Items
  without an `id` get `<tag>-<num>` so the panel can jump. Validates `on=`.
- `final.ts` `finalizeReview` (`--final` only, before bibliography and numbering): drops
  `comment`/`todo`/`review`/`team`, unwraps `draft`, accepts `change` (keeps `<new>` or the
  bare insertion), strips `status`/`by`/`verified-by`, and warns once: `final build: 3 open
  comments, 2 open tasks, 4 blocks not verified`.
- `emit.ts` `renderReviewIsland`: `<script type="application/json" id="delta-review">`
  with `{ team, items? }` — `items` only when the document has a `<review>`. Absent when
  there is neither a team nor a panel, so plain documents are unchanged.

### The island

```ts
{ team: { id, name, kind, color }[],
  items?: { kind: "comment"|"todo"|"change"|"status", id, tag, num?, status,
            by?, for?, verifiedBy?, date?, due?, priority?, changeKind?, note?, on?,
            text, html, replies?: { by?, date?, text, html }[],
            heading?: { level, num, id, title }, file? }[] }
```

`file` is set on a project item that lives in another output (the runtime links
`file#id`); own-file items have it blanked, like the ToC island.

## What the runtime does

- `elements/collab.ts`: island reader, `memberChip(id)` (dot + name + "agent" badge, in the
  member's `data-accent`), and `window.Delta.review` — the two document-wide switches:
  `setAnnotations(on)` → `html[data-review="off"]` hides every annotation;
  `setChanges("markup"|"final"|"original")` → `html[data-changes]` picks the change view.
  Both fire `delta:review` on `document`. Nothing is persisted.
- `comment.ts`: superscript marker + the thread in a `Delta.popover` bubble; relocates the
  whole element into its `on=` target's label. A comment snapshotted into a `<ref>` preview
  renders statically.
- `todo.ts`: the checklist row. `change.ts`: normalizes to `<delta-old class="chg-del">` /
  `<delta-new class="chg-ins">` + a marker with who/when/why. `shared.ts` `applyStatus`:
  the `.status-pill` every block label gets (hooked in `environment.ts`, `section.ts`,
  `draft.ts`). `review.ts`: the panel.
- CSS: `collab.css` (chip, `data-review="off"`, print), `comment.css`, `todo.css`,
  `status.css`, `change.css` (the three views), `review.css`. Every element that carries
  `data-accent` re-derives `--delta-accent-ink/-soft` from its seed (as `box.css` does) so
  chips stay legible in dark mode. Print hides every annotation and shows changes as final.

## The CLI

```
delta build paper.dlt --final -o paper.html        # the clean publication (+ one summary warning)
delta review paper.dlt                             # text report on stdout, diagnostics on stderr
delta review project.toml --status open --for claude
delta review paper.dlt --json                      # { team, summary, items } (no AST nodes)
```

Filters: `--status`, `--for`, `--by`, `--kind comment|todo|change|status`. The
formatting lives in `src/review-report.ts` (pure functions).

## Annotating a paper as an AI agent

If you are an agent editing a `.dlt` with a human:

1. **Sign everything.** Put `by="<your member id>"` on every comment, task, change and
   block you write. Ask for (or add) your `<member … kind="agent"/>` if the team lacks it.
2. **Never edit existing prose silently.** Wrap edits in `<change by="…"><old>…</old><new>…</new></change>`;
   insertions as `<change by="…">…</change>`, deletions as `<change by="…"><old>…</old></change>`.
   Never edit inside someone's `<old>`. Add a short `note` with the reason.
3. **Mark what you write.** New proofs and lemmas start as `status="sketch"` (or `draft`);
   set `status="review"` when you believe they are complete. Only a human sets
   `verified` and `verified-by`.
4. **Ask in place.** A doubt is a `<comment>` right where it applies (or `on="id"`); a
   request for work is a `<todo for="…">`. Resolve a thread by setting `status="resolved"`
   and, if useful, a `<reply>`; finish a task by setting `status="done"`.
5. **Give ids** to comments and tasks you expect to be referenced (`id="c-…"`, `id="t-…"`);
   write `date="YYYY-MM-DD"`.
6. **Read the state** with `delta review file.dlt --json` (or `--status open --for <you>`),
   not by parsing the HTML. **Check the publication** with `delta build --final`: it warns
   with what is left undone.
7. **Math:** bare `<` inside `$…$`; entities elsewhere. Unknown statuses/priorities warn —
   read the diagnostics.
