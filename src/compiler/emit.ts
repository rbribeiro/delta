import { basename, dirname } from "node:path";
import { elements, hasTag, textContent, titleOf, type ElementNode, type Node } from "./ast";
import type { CompileContext } from "./context";
import { escapeHtml } from "./preprocess";
import { katexCss } from "./katex-css";
import { resolveLang, stringsFor } from "./strings";
import { CORE_CSS, RUNTIME_JS, THEMES } from "../generated/assets";

const DEFAULT_TYPE = "article";
const CONTAINER_TAGS = new Set(["chapter", "section", "subsection", "subsubsection"])

/**
 * Serializes the AST into a standalone HTML file. Every tag becomes `<delta-tag>`
 * — the compiler ships data (num attributes, ids, pre-rendered math) and the inlined runtime renders them. 
 * All CSS/JS/fonts are inlined; the output references no external resources. KaTeX CSS is included only when the
 * output carries math — rendered in this file, or arriving via a cross-file ref/cite snapshot or a project-wide ToC title.
 * 
 * @param doc - the root AST node of the document to emit
 * @param ctx - the compilation context, which contains information about the document and its dependencies
 * @param globalById - an optional map of element IDs to their corresponding AST nodes, used for cross-file references
 * 
 * @returns - the serialized HTML string
 */
export function emit(
  doc: ElementNode,
  ctx: CompileContext,
  globalById?: Map<string, ElementNode>,
): string {
  const titleEl = titleOf(doc);
  const title = titleEl ? textContent(titleEl).trim() : basename(ctx.file).replace(/\.dlt$/, "");

  // `type` selects the @layer delta.theme overrides (article is the default).
  const type = doc.attrs.type ?? DEFAULT_TYPE;
  const themeCss = THEMES[type] ?? THEMES[DEFAULT_TYPE];

  // Localized UI strings for the document's language, inlined as an inert data
  // island the runtime reads via t(). `<` is escaped so a string can't break out
  // of the </script>.
  const i18n = JSON.stringify(stringsFor(resolveLang(ctx.lang))).replace(/</g, "\\u003c");

  const body = serialize(doc);
  // Snapshot every <ref> target into an inert <template> so the runtime can clone
  // it into a pop-over preview without a fetch. Only referenced ids are emitted.
  // On the project path `globalById` spans every file, so a cross-file target's
  // copy ships into this output too.
  const templates = renderTemplates(doc, ctx, globalById);
  // Heading tree for <delta-toc>, shipped as an inert JSON island.
  const toc = renderTocIsland(ctx);
  // Collaboration data (<team> + the items a <review> panel lists), same shape.
  const review = renderReviewIsland(doc, ctx);

  // The head is assembled after the templates/ToC island, because on the project
  // path those can carry math rendered in *another* file (a cross-file snapshot,
  // a project-wide ToC title) — renderTemplates/renderTocIsland flip ctx.mathUsed
  // so this file still ships the KaTeX CSS that hides `.katex-mathml`.
  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(title)}</title>`,
    `<style>\n${CORE_CSS}\n</style>`,
    // Built-in named theme (<document theme="impatech">): tokens only, in its own
    // @layer delta.builtin. That layer sits above the base tokens but below the
    // [data-accent]/[data-mode] overlays, the components and the per-type theme —
    // so `theme-accent`/`theme-mode` still recolor a named theme, and a deck keeps
    // its projector type scale. Distinct from ctx.userCss below, which stays last.
    ...(ctx.builtinCss ? [`<style>\n${ctx.builtinCss}\n</style>`] : []),
    ...(themeCss ? [`<style>\n${themeCss}\n</style>`] : []),
    ...(ctx.mathUsed ? [`<style>\n${katexCss()}\n</style>`] : []),
    // Custom-element pack themes (<import>): inlined before the author theme so a
    // pack styles its own elements, but the document author's theme still wins.
    ...ctx.imports.flatMap((i) => (i.css ? [`<style>\n${i.css}\n</style>`] : [])),
    // Author theme (<document theme>) goes last and unlayered, so it overrides
    // the design system, the per-type theme layer, and even the inlined KaTeX CSS.
    ...(ctx.userCss ? [`<style>\n${ctx.userCss}\n</style>`] : []),
  ].join("\n");
  // Custom-element pack scripts (<import>): inlined after the runtime so they can
  // use window.Delta; each registers its own delta-* custom elements.
  const packScripts = ctx.imports.length
    ? ctx.imports
        .map((i) => `<script>\n/* pack: ${i.name ?? basename(dirname(i.source))} */\n${i.js}\n</script>`)
        .join("\n") + "\n"
    : "";

  const dataAccent = ctx.themeAccent ? ` data-accent="${escapeAttr(ctx.themeAccent)}"` : "";
  // `data-mode` selects the dark (or OS-auto) token override in base.css; emitted only
  // when the author opts in, so a light document keeps the bare `<html lang="…">` tag.
  const dataMode = ctx.themeMode ? ` data-mode="${escapeAttr(ctx.themeMode)}"` : "";
  // `data-type` is the runtime/CSS hook for per-type chrome (e.g. the presentation
  // deck). Emitted only for non-default types so default (article) docs stay byte-
  // identical (the emit tests assert the bare `<html lang="…">` tag).
  const dataType = type !== DEFAULT_TYPE ? ` data-type="${escapeAttr(type)}"` : "";
  return `<!DOCTYPE html>
<html lang="${escapeAttr(ctx.lang)}"${dataAccent}${dataMode}${dataType}>
<head>
${head}
</head>
<body>
${body}
${templates}${toc}${review}<script type="application/json" id="delta-i18n">${i18n}</script>
<script>
${RUNTIME_JS}
</script>
${packScripts}
</body>
</html>
`;
}


/**
 * 
 * Builds an inert `<template data-delta-pop="id">…</template>` at the end of the page
 * for every element referenced by a `<ref>`/`<cite>`/`<solution of>`/`<proof of>` (recorded in `ctx.referencedIds`). 
 * The runtime clones a template into the pop-over preview, so no fetch is needed. On the project path the caller
 * passes a `globalById` that maps every element ID to its AST node across all files, so copying a node from another file still works. 
 * Returns an empty string when nothing is referenced.
 * 
 * @param doc - the root AST node of the document to emit
 * @param ctx - the compilation context, which contains information about the document and its dependencies
 * @param globalById - an optional map of element IDs to their corresponding AST nodes, used for cross-file references
 * 
 * @returns - the serialized HTML string of the templates for referenced IDs or empty string if no IDs are referenced
 */
function renderTemplates(
  doc: ElementNode,
  ctx: CompileContext,
  globalById?: Map<string, ElementNode>,
): string {
  if (ctx.referencedIds.size === 0) return "";
  const byId = globalById ?? new Map<string, ElementNode>();
  if (!globalById) {
    for (const el of elements(doc)) {
      const id = el.attrs.id;
      if (id && !byId.has(id)) byId.set(id, el);
    }
  }
  const out: string[] = [];
  for (const id of ctx.referencedIds) {
    const node = byId.get(id);
    if (node) {
      // For elements that contain a lot of other elements such as chapters, sections, and so on
      // the template holds only the title
      let snapshot = node;
      if (CONTAINER_TAGS.has(node.tag)) {
        const titleEl = titleOf(node);
        snapshot = {type: "element", tag: node.tag, attrs: node.attrs, children: titleEl ? [titleEl] : []};
      }
      // A cross-file target may carry math this file didn't render itself.
      ctx.mathUsed ||= containsMath([snapshot]);
      out.push(`<template data-delta-pop="${escapeAttr(id)}">${serialize(snapshot)}</template>`);
    }
  }
  return out.length ? out.join("\n") + "\n" : "";
}

/**
 * Builds an inert `<script type="application/json" id="delta-toc">…</script>` element containing the table of contents data. The runtime reads this JSON to render the `<delta-toc>` component. Returns an empty string when there are no entries in the table of contents.
 * 
 * @param ctx - the compiler context
 * @returns - the serialized stringfied array of objects representing the table of contents as a `<script type="application/json" id="delta-toc">` element, or an empty string if there are no entries in the table of contents
 */
function renderTocIsland(ctx: CompileContext): string {
  if (ctx.toc.length === 0) return "";
  // A project-wide ToC may carry heading math rendered in another file.
  ctx.mathUsed ||= ctx.toc.some((e) => containsMath(e.title));
  const data = ctx.toc.map((e) => ({
    level: e.level,
    id: e.id,
    num: e.num,
    title: e.title.map(serialize).join(""),
    // Present only for a project-wide entry whose section lives in another output.
    ...(e.file ? { file: e.file } : {}),
  }));
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/json" id="delta-toc">${json}</script>\n`;
}

/**
 * Builds the inert `<script type="application/json" id="delta-review">` island: the `<team>`
 * members (the runtime colors/badges every `by`/`for` chip from them) and, only when the
 * document carries a `<review>` panel, the collected collaboration items with their bodies
 * serialized (so math survives, like ToC titles). Shipped only where it is read: a document
 * with a panel, or one whose own collaboration items need the team for their author chips.
 * A plain document — or a project file that merely shares the team — stays byte-identical.
 */
function renderReviewIsland(doc: ElementNode, ctx: CompileContext): string {
  const hasPanel = hasTag(doc, "review");
  const ownItems = ctx.review.some((i) => !i.file);
  if (!hasPanel && !(ctx.team.size > 0 && ownItems)) return "";

  const ser = (nodes: Node[]): string => nodes.map(serialize).join("");
  const data: Record<string, unknown> = { team: [...ctx.team.values()] };
  if (hasPanel) {
    // A project-wide panel may carry bodies/titles with math rendered in another file.
    ctx.mathUsed ||= ctx.review.some(
      (i) =>
        containsMath(i.body) ||
        (i.replies ?? []).some((r) => containsMath(r.body)) ||
        (i.heading ? containsMath(i.heading.title) : false),
    );
    data.items = ctx.review.map((i) =>
      compact({
        kind: i.kind,
        id: i.id,
        tag: i.tag,
        num: i.num,
        status: i.status,
        by: i.by,
        for: i.for,
        verifiedBy: i.verifiedBy,
        date: i.date,
        due: i.due,
        priority: i.priority,
        changeKind: i.changeKind,
        note: i.note,
        on: i.on,
        text: i.text,
        html: ser(i.body),
        replies: i.replies?.map((r) => compact({ by: r.by, date: r.date, text: r.text, html: ser(r.body) })),
        heading: i.heading
          ? { level: i.heading.level, num: i.heading.num, id: i.heading.id, title: ser(i.heading.title) }
          : undefined,
        file: i.file,
      }),
    );
  }
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return `<script type="application/json" id="delta-review">${json}</script>\n`;
}

/** Drops undefined-valued keys so the island JSON stays small. */
function compact<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  return out;
}

/** True when any node in the tree is pre-rendered math (a RawNode stamped by renderMath). */
function containsMath(nodes: Node[]): boolean {
  return nodes.some(
    (n) =>
      (n.type === "raw" && n.kind === "math") ||
      (n.type === "element" && containsMath(n.children)),
  );
}

function serialize(node: Node): string {
  switch (node.type) {
    case "text":
      return escapeHtml(node.text);
    case "raw":
      return node.html;
    case "element": {
      const tag = `delta-${node.tag}`;
      const attrs = Object.entries(node.attrs)
        .map(([k, v]) => ` ${k}="${escapeAttr(v)}"`)
        .join("");
      // Custom elements cannot self-close in HTML; always emit an explicit close tag.
      return `<${tag}${attrs}>${node.children.map(serialize).join("")}</${tag}>`;
    }
  }
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
