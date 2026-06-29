import { basename, dirname } from "node:path";
import { elements, textContent, type ElementNode, type Node } from "./ast";
import type { CompileContext } from "./context";
import { katexCss } from "./katex-css";
import { resolveLang, stringsFor } from "./strings";
import { CORE_CSS, RUNTIME_JS, THEMES } from "../generated/assets";

const DEFAULT_TYPE = "article";
const CONTAINER_TAGS = new Set(["chapter", "section", "subsection", "subsubsection"])

/**
 * Serializes the AST into a standalone HTML file. Every tag becomes `<delta-tag>`
 * — the compiler ships data (num attributes, ids, pre-rendered math) and the inlined runtime renders them. 
 * All CSS/JS/fonts are inlined; the output references no external resources. KaTeX CSS is included only when math was rendered.
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
  const titleEl = doc.children.find(
    (c): c is ElementNode => c.type === "element" && c.tag === "title",
  );
  const title = titleEl ? textContent(titleEl).trim() : basename(ctx.file).replace(/\.dlt$/, "");

  // `type` selects the @layer delta.theme overrides (article is the default).
  const type = doc.attrs.type ?? DEFAULT_TYPE;
  const themeCss = THEMES[type] ?? THEMES[DEFAULT_TYPE];

  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeText(title)}</title>`,
    `<style>\n${CORE_CSS}\n</style>`,
    ...(themeCss ? [`<style>\n${themeCss}\n</style>`] : []),
    ...(ctx.mathUsed ? [`<style>\n${katexCss()}\n</style>`] : []),
    // Custom-element pack themes (<import>): inlined before the author theme so a
    // pack styles its own elements, but the document author's theme still wins.
    ...ctx.imports.flatMap((i) => (i.css ? [`<style>\n${i.css}\n</style>`] : [])),
    // Author theme (<document theme>) goes last and unlayered, so it overrides
    // the design system, the per-type theme layer, and even the inlined KaTeX CSS.
    ...(ctx.userCss ? [`<style>\n${ctx.userCss}\n</style>`] : []),
  ].join("\n");

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
  // Custom-element pack scripts (<import>): inlined after the runtime so they can
  // use window.Delta; each registers its own delta-* custom elements.
  const packScripts = ctx.imports.length
    ? ctx.imports
        .map((i) => `<script>\n/* pack: ${basename(dirname(i.source))} */\n${i.js}\n</script>`)
        .join("\n") + "\n"
    : "";

  const dataAccent = ctx.themeAccent ? ` data-accent="${escapeAttr(ctx.themeAccent)}"` : "";
  // `data-type` is the runtime/CSS hook for per-type chrome (e.g. the presentation
  // deck). Emitted only for non-default types so default (article) docs stay byte-
  // identical (the emit tests assert the bare `<html lang="…">` tag).
  const dataType = type !== DEFAULT_TYPE ? ` data-type="${escapeAttr(type)}"` : "";
  return `<!DOCTYPE html>
<html lang="${escapeAttr(ctx.lang)}"${dataAccent}${dataType}>
<head>
${head}
</head>
<body>
${body}
${templates}${toc}<script type="application/json" id="delta-i18n">${i18n}</script>
<script>
${RUNTIME_JS}
</script>
${packScripts}
</body>
</html>
`;
}

/**
 * Builds an inert `<template data-delta-pop="id">…</template>` for every target a
 * `<ref>`/`<cite>`/`<solution of>`/`<proof of>` resolved to (recorded in `ctx.referencedIds`). The id→node map
 * is built in a single walk of this document; the runtime clones a template into
 * the pop-over preview, so no fetch is needed. On the project path the caller
 * passes a `globalById` spanning every file, so a cross-file target's copy still
 * ships here. Returns "" when nothing is referenced.
 */

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
    let templateString = "";
    if (node) {
      // For elements that contain a lot of other elements such as chapters, sections, and so on
      // the template holds only the title
      if (CONTAINER_TAGS.has(node.tag)) {
        const titleEl = node.children.find( (c): c is ElementNode => c.type === "element" && c.tag === "title");
        const reprNode: ElementNode = {type: "element", tag: node.tag, attrs: node.attrs, children: []};
        reprNode.children = titleEl? [titleEl] : [];
        out.push(`<template data-delta-pop="${escapeAttr(id)}">${serialize(reprNode)}</template>`);
      
      } else {
        out.push(`<template data-delta-pop="${escapeAttr(id)}">${serialize(node)}</template>`);
      }
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

function serialize(node: Node): string {
  switch (node.type) {
    case "text":
      return escapeText(node.text);
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

function escapeText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, "&quot;");
}
